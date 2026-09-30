import { Router, Request, Response } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import fs from 'fs';
import { PrismaClient, EmailStatus } from '@prisma/client';
import { emailQueue } from '../queues/emailWorker';

const router = Router();
const prisma = new PrismaClient();

// Ensure temporary uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const upload = multer({ dest: 'uploads/' });

interface CsvRow {
  recipientEmail?: string;
  email?: string;
  subject: string;
  body: string;
  scheduledAt?: string;
}

// POST /api/emails/bulk-upload
router.post('/bulk-upload', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  const { senderId, userId, delayBetweenMs } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  // Cleanup helper
  const cleanUpFile = () => {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Error deleting temp upload file:', err);
      }
    }
  };

  try {
    // 1. Resolve Sender ID
    let targetSenderId = senderId;
    if (!targetSenderId) {
      const defaultSender = await prisma.emailSender.findFirst();
      if (!defaultSender) {
        cleanUpFile();
        return res.status(400).json({ error: 'No sender configured in system' });
      }
      targetSenderId = defaultSender.id;
    }

    // 2. Parse CSV Stream
    const rows: CsvRow[] = [];
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csvParser())
        .on('data', (data: CsvRow) => rows.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Clean up temporary disk file immediately after reading
    cleanUpFile();

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Uploaded CSV file is empty' });
    }

    const defaultDate = new Date();
    const baseDelayMs = Number(delayBetweenMs) || 1000;

    // 3. Prepare Batch Payload
    const recordsToCreate = rows.map((row) => {
      const scheduledDate = row.scheduledAt ? new Date(row.scheduledAt) : defaultDate;
      return {
        recipientEmail: row.recipientEmail || row.email || '',
        subject: row.subject || '',
        body: row.body || '',
        scheduledAt: scheduledDate,
        status: EmailStatus.SCHEDULED,
        senderId: targetSenderId,
      };
    });

    // 4. Batch Insert into Database via Prisma Transaction
    const createdRecords = await prisma.$transaction(
      recordsToCreate.map((data) => prisma.scheduledEmail.create({ data }))
    );

    // 5. Build Queue Jobs with Staggered Delays
    const queueJobs = createdRecords.map((record, index) => {
      const initialDelay = Math.max(0, new Date(record.scheduledAt).getTime() - Date.now());
      const totalDelay = initialDelay + index * baseDelayMs;

      return {
        name: 'dispatch-email',
        data: {
          scheduledEmailId: record.id,
          senderId: targetSenderId,
          userId: userId || record.senderId,
          recipientEmail: record.recipientEmail,
          subject: record.subject,
          body: record.body,
          delayBetweenMs: baseDelayMs,
        },
        opts: {
          delay: totalDelay,
        },
      };
    });

    // 6. Bulk enqueue into BullMQ
    const jobs = await emailQueue.addBulk(queueJobs);

    return res.status(201).json({
      message: `Successfully scheduled ${jobs.length} emails from CSV`,
      totalRows: rows.length,
    });
  } catch (error) {
    cleanUpFile();
    console.error('Error processing bulk upload:', error);
    return res.status(500).json({ error: 'Failed to process CSV records' });
  }
});

export default router;