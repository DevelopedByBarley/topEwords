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
            $table->string('file_type', 10);
            $table->unsignedSmallInteger('total_pages');
            $table->timestamps();

            $table->index('user_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE user_books ADD COLUMN compressed_text MEDIUMBLOB NOT NULL AFTER file_type');
        } else {
            Schema::table('user_books', function (Blueprint $table) {
                $table->binary('compressed_text');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_books');
    }
};
