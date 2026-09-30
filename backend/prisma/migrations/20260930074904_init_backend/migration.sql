-- DropForeignKey
ALTER TABLE `EmailCampaign` DROP FOREIGN KEY `EmailCampaign_userId_fkey`;

-- DropForeignKey
ALTER TABLE `EmailSender` DROP FOREIGN KEY `EmailSender_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ScheduledEmail` DROP FOREIGN KEY `ScheduledEmail_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `ScheduledEmail` DROP FOREIGN KEY `ScheduledEmail_senderId_fkey`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `slackWebhookUrl` TEXT NULL;

-- AddForeignKey
ALTER TABLE `EmailSender` ADD CONSTRAINT `EmailSender_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaign` ADD CONSTRAINT `EmailCampaign_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `EmailSender`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `EmailCampaign` RENAME INDEX `EmailCampaign_userId_fkey` TO `EmailCampaign_userId_idx`;

-- RenameIndex
ALTER TABLE `EmailSender` RENAME INDEX `EmailSender_userId_fkey` TO `EmailSender_userId_idx`;

-- RenameIndex
ALTER TABLE `ScheduledEmail` RENAME INDEX `ScheduledEmail_campaignId_fkey` TO `ScheduledEmail_campaignId_idx`;
