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
                'billing_zip', 'billing_city', 'billing_address', 'billing_phone',
                'billing_company_registration_number', 'billing_type',
            ]),
        ]);
    }

    public function update(BillingUpdateRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Magánszemélynél nincs adószám — cégről egyénire váltva a company módban
        // unmountolt mező nem érkezik be, így a fill() a korábbi adószámot bennhagyná
        // a DB-ben. Explicit nullázzuk, hogy régi cégadat ne ragadjon a fiókon.
        if (($data['billing_type'] ?? null) === 'individual') {
            $data['billing_tax_number'] = null;
            $data['billing_company_registration_number'] = null;
        }

        $request->user()->fill($data)->save();

        return to_route('billing.edit')->with('success', 'Számlázási adatok mentve.');
    }
}
