<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class TopicRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name.hu' => ['required', 'string', 'max:100'],
            'name.en' => ['required', 'string', 'max:100'],
            'name.it' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name.hu' => 'magyar név',
            'name.en' => 'angol név',
            'name.it' => 'olasz név',
        ];
    }
}
