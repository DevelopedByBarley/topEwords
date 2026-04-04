<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('words', function (Blueprint $table) {
            $table->id();
            $table->string('word')->unique();
            $table->string('meaning_hu')->nullable();
            $table->text('extra_meanings')->nullable();
            $table->string('synonyms')->nullable();
            $table->string('part_of_speech', 10)->nullable();
            $table->string('example_en')->nullable();
            $table->string('example_hu')->nullable();
            $table->unsignedInteger('rank')->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('words');
    }
};
