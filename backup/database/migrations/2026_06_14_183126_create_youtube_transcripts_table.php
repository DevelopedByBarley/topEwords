<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('youtube_transcripts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('video_id', 20);
            $table->string('title');
            $table->unsignedSmallInteger('total_pages');
            $table->unsignedBigInteger('text_size')->default(0);
            $table->timestamps();

            $table->index('user_id');
        });

        // Tömörített, időbélyeges felirat-szegmensek JSON-ja (gzip). MySQL: MEDIUMBLOB (max 16 MB),
        // SQLite (tesztek): a BLOB típus eleve korlátlan.
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE youtube_transcripts ADD COLUMN compressed_segments MEDIUMBLOB NOT NULL AFTER title');
        } else {
            Schema::table('youtube_transcripts', function (Blueprint $table) {
                $table->binary('compressed_segments');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('youtube_transcripts');
    }
};
