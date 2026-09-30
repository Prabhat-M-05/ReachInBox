-- DropForeignKey
ALTER TABLE `ScheduledEmail` DROP FOREIGN KEY `ScheduledEmail_campaignId_fkey`;

-- DropIndex
DROP INDEX `ScheduledEmail_campaignId_fkey` ON `ScheduledEmail`;

-- AlterTable
ALTER TABLE `ScheduledEmail` MODIFY `campaignId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
