CREATE TABLE `page_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`tracked_page_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`extracted_text` text NOT NULL,
	`text_hash` text NOT NULL,
	`diff_summary` text,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tracked_page_id`) REFERENCES `tracked_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_snapshots_workspace_idx` ON `page_snapshots` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `page_snapshots_tracked_page_idx` ON `page_snapshots` (`tracked_page_id`);--> statement-breakpoint
CREATE INDEX `page_snapshots_text_hash_idx` ON `page_snapshots` (`text_hash`);--> statement-breakpoint
CREATE TABLE `tracked_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`competitor_id` text,
	`url` text NOT NULL,
	`page_type` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_snapshot_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tracked_pages_workspace_idx` ON `tracked_pages` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `tracked_pages_competitor_idx` ON `tracked_pages` (`competitor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_pages_url_workspace_idx` ON `tracked_pages` (`url`,`workspace_id`);--> statement-breakpoint
ALTER TABLE `competitors` ADD `intelligence_status` text DEFAULT 'unresolved' NOT NULL;--> statement-breakpoint
ALTER TABLE `competitors` ADD `crustdata_company_id` text;--> statement-breakpoint
ALTER TABLE `competitors` ADD `crustdata_match_confidence` integer;--> statement-breakpoint
ALTER TABLE `competitors` ADD `crustdata_profile_json` text;--> statement-breakpoint
ALTER TABLE `competitors` ADD `enrichment_error` text;--> statement-breakpoint
ALTER TABLE `competitors` ADD `enriched_at` text;--> statement-breakpoint
CREATE INDEX `competitors_crustdata_company_idx` ON `competitors` (`crustdata_company_id`);--> statement-breakpoint
ALTER TABLE `suggested_competitors` ADD `intelligence_status` text DEFAULT 'unresolved' NOT NULL;--> statement-breakpoint
ALTER TABLE `suggested_competitors` ADD `crustdata_company_id` text;--> statement-breakpoint
ALTER TABLE `suggested_competitors` ADD `crustdata_match_confidence` integer;--> statement-breakpoint
ALTER TABLE `suggested_competitors` ADD `identify_error` text;--> statement-breakpoint
ALTER TABLE `suggested_competitors` ADD `identified_at` text;--> statement-breakpoint
CREATE INDEX `suggested_competitors_crustdata_company_idx` ON `suggested_competitors` (`crustdata_company_id`);