<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['word', 'rank', 'meaning'])]
class Word extends Model
{
    public function knownByUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_word');
    }

    public function folders(): BelongsToMany
    {
        return $this->belongsToMany(Folder::class, 'folder_word');
    }
}
