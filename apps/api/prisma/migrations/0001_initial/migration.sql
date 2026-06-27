CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `display_name` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `users_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notes_metadata` (
  `id` VARCHAR(191) NOT NULL,
  `owner_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `format` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `sync_state` VARCHAR(191) NOT NULL,
  `sync_enabled` BOOLEAN NOT NULL DEFAULT false,
  `encrypted_content` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `notes_metadata_owner_id_idx`(`owner_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `shared_notes` (
  `id` VARCHAR(191) NOT NULL,
  `note_id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `encrypted_content` JSON NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `format` VARCHAR(191) NOT NULL,
  `policy` JSON NOT NULL,
  `password_hash` VARCHAR(191) NULL,
  `access_count` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `shared_notes_slug_key`(`slug`),
  INDEX `shared_notes_note_id_idx`(`note_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `share_access_logs` (
  `id` VARCHAR(191) NOT NULL,
  `share_id` VARCHAR(191) NOT NULL,
  `accessed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `success` BOOLEAN NOT NULL,
  INDEX `share_access_logs_share_id_idx`(`share_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `refresh_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `refresh_token` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  INDEX `refresh_sessions_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notes_metadata`
  ADD CONSTRAINT `notes_metadata_owner_id_fkey`
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `shared_notes`
  ADD CONSTRAINT `shared_notes_note_id_fkey`
  FOREIGN KEY (`note_id`) REFERENCES `notes_metadata`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `shared_notes`
  ADD CONSTRAINT `shared_notes_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `share_access_logs`
  ADD CONSTRAINT `share_access_logs_share_id_fkey`
  FOREIGN KEY (`share_id`) REFERENCES `shared_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `refresh_sessions`
  ADD CONSTRAINT `refresh_sessions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
