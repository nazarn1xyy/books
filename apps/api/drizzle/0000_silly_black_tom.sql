CREATE TYPE "public"."book_status" AS ENUM('reading', 'plan', 'finished', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"id" uuid PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"paragraph_index" integer NOT NULL,
	"preview_text" text
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"book_id" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"cover_url" text,
	CONSTRAINT "favorites_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"id" uuid PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"book_title" text,
	"book_author" text,
	"text" text NOT NULL,
	"note" text,
	"color" text DEFAULT 'yellow' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"book_id" text NOT NULL,
	"paragraph_index" integer DEFAULT 0 NOT NULL,
	"scroll_ratio" real DEFAULT 0 NOT NULL,
	"current_page" integer DEFAULT 0 NOT NULL,
	"total_pages" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reading_progress_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "user_books" (
	"user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"book_id" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"cover_url" text,
	"status" "book_status" DEFAULT 'reading' NOT NULL,
	"format" text DEFAULT 'fb2' NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_books_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_sync_idx" ON "bookmarks" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "favorites_sync_idx" ON "favorites" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "quotes_sync_idx" ON "quotes" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "reading_progress_sync_idx" ON "reading_progress" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_books_sync_idx" ON "user_books" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_nickname_lower_uq" ON "users" USING btree (lower("nickname"));