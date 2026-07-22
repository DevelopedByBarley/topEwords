<?php

namespace App\Http\Requests;

use App\Models\Report;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['required', Rule::in(Report::CATEGORIES)],
            'description' => ['required', 'string', 'max:2000'],
            'word_id' => [
                Rule::requiredIf(fn () => $this->input('category') === 'word_data'),
                'nullable',
                'integer',
                Rule::exists('words', 'id'),
            ],
        ];
    }
}
