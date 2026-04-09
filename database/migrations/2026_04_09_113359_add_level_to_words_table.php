<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->tinyInteger('level')->unsigned()->default(1)->after('rank');
        });

        DB::statement('
            UPDATE words SET level = CASE
                WHEN rank <= 500 THEN 1
                WHEN rank <= 1500 THEN 2
                WHEN rank <= 3000 THEN 3
                WHEN rank <= 5000 THEN 4
                WHEN rank <= 7500 THEN 5
                ELSE 6
            END
        ');
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropColumn('level');
        });
    }
};
