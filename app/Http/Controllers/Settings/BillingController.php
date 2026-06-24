<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\BillingUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BillingController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/billing', [
            'billingData' => $request->user()->only([
                'billing_name', 'billing_tax_number', 'billing_country',
                'billing_zip', 'billing_city', 'billing_address', 'billing_type',
            ]),
        ]);
    }

    public function update(BillingUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated())->save();

        return to_route('billing.edit')->with('success', 'Számlázási adatok mentve.');
    }
}
