<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserCustomWord;

class UserCustomWordPolicy
{
    public function update(User $user, UserCustomWord $customWord): bool
    {
        return $user->id === $customWord->user_id;
    }

    public function delete(User $user, UserCustomWord $customWord): bool
    {
        return $user->id === $customWord->user_id;
    }
}
