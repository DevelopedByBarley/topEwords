<?php

namespace App\Policies;

use App\Models\FlashcardFolder;
use App\Models\User;

class FlashcardFolderPolicy
{
    public function update(User $user, FlashcardFolder $flashcardFolder): bool
    {
        return $user->id === $flashcardFolder->user_id;
    }

    public function delete(User $user, FlashcardFolder $flashcardFolder): bool
    {
        return $user->id === $flashcardFolder->user_id;
    }
}
