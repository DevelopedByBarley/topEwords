<?php

namespace App\Concerns;

use Illuminate\Validation\Validator;

trait ValidatesFlashcardSettings
{
    /**
     * Learning steps must be strictly increasing so each "Jó" (next step) is
     * genuinely longer than the current step's "Nehéz". A non-increasing config
     * (e.g. [10, 10] or [10, 5]) leaves no whole-minute room for Hard between
     * Again and Good, forcing the SRS scheduler to collapse Hard onto Good.
     */
    protected function validateLearningStepsIncrease(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $steps = $this->input('learning_steps');

            if (! is_array($steps)) {
                return;
            }

            $values = array_values($steps);

            for ($i = 1; $i < count($values); $i++) {
                if (! is_numeric($values[$i]) || ! is_numeric($values[$i - 1])) {
                    continue;
                }

                if ((int) $values[$i] <= (int) $values[$i - 1]) {
                    $validator->errors()->add(
                        "learning_steps.{$i}",
                        'A tanulási lépéseknek növekvő sorrendben kell lenniük (minden lépés hosszabb az előzőnél).'
                    );
                    break;
                }
            }
        });
    }
}
