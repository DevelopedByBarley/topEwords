<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])]
class UserCustomWord extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
