<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_books', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('file_type', 10); // 'pdf' or 'epub'
            $table->unsignedSmallInteger('total_pages');
            $table->timestamps();

            $table->index('user_id');
        });

        // MEDIUMBLOB supports up to 16 MB — enough for any compressed book text
        DB::statement('ALTER TABLE user_books ADD COLUMN compressed_text MEDIUMBLOB NOT NULL AFTER file_type');
    }

    public function down(): void
    {
        Schema::dropIfExists('user_books');
    }
};
