<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            UPDATE words SET level = LEAST(6, FLOOR((rank - 1) * 6.0 / (SELECT MAX(rank) FROM (SELECT MAX(rank) AS max_rank FROM words) AS r)) + 1)
        ');
    }

    public function down(): void
    {
        DB::statement('
            UPDATE words SET level = CASE
                WHEN rank <= 500  THEN 1
                WHEN rank <= 1500 THEN 2
                WHEN rank <= 3000 THEN 3
                WHEN rank <= 5000 THEN 4
                WHEN rank <= 7500 THEN 5
                ELSE 6
            END
        ');
    }
};
