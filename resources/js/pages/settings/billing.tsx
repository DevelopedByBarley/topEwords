import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { edit } from '@/routes/billing';

type BillingType = 'individual' | 'company';

interface Props {
    billingData: {
        billing_name: string | null;
        billing_tax_number: string | null;
        billing_country: string;
        billing_zip: string | null;
        billing_city: string | null;
        billing_address: string | null;
        billing_type: BillingType;
    };
}

export default function Billing({ billingData }: Props) {
    const [billingType, setBillingType] = useState<BillingType>(
        billingData.billing_type ?? 'individual',
    );

    return (
        <>
            <Head title="Számlázási adatok" />

            <h1 className="sr-only">Számlázási adatok</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Számlázási adatok"
                    description="Ezeket az adatokat a számlák kiállításához használjuk"
                />

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={billingType}
                    onValueChange={(v) => {
                        if (v) setBillingType(v as BillingType);
                    }}
                >
                    <ToggleGroupItem value="individual">
                        Magánszemély
                    </ToggleGroupItem>
                    <ToggleGroupItem value="company">Cég</ToggleGroupItem>
                </ToggleGroup>

                <Form
                    action="/settings/billing"
                    method="put"
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <input
                                type="hidden"
                                name="billing_type"
                                value={billingType}
                            />
                            <input
                                type="hidden"
                                name="billing_country"
                                value={billingData.billing_country ?? 'HU'}
                            />

                            <div className="grid gap-2">
                                <Label htmlFor="billing_name">
                                    {billingType === 'company'
                                        ? 'Cégnév'
                                        : 'Teljes név'}
                                </Label>
                                <Input
                                    id="billing_name"
                                    name="billing_name"
                                    required
                                    className="mt-1 block w-full"
                                    defaultValue={billingData.billing_name ?? ''}
                                    placeholder={
                                        billingType === 'company'
                                            ? 'pl. Példa Kft.'
                                            : 'pl. Kiss János'
                                    }
                                    autoComplete={
                                        billingType === 'company'
                                            ? 'organization'
                                            : 'name'
                                    }
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.billing_name}
                                />
                            </div>

                            {billingType === 'company' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="billing_tax_number">
                                        Adószám
                                    </Label>
                                    <Input
                                        id="billing_tax_number"
                                        name="billing_tax_number"
                                        required
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            billingData.billing_tax_number ?? ''
                                        }
                                        placeholder="pl. 12345678-1-01"
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errors.billing_tax_number}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1 grid gap-2">
                                    <Label htmlFor="billing_zip">
                                        Irányítószám
                                    </Label>
                                    <Input
                                        id="billing_zip"
                                        name="billing_zip"
                                        required
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            billingData.billing_zip ?? ''
                                        }
                                        placeholder="1234"
                                        autoComplete="postal-code"
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errors.billing_zip}
                                    />
                                </div>

                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="billing_city">Város</Label>
                                    <Input
                                        id="billing_city"
                                        name="billing_city"
                                        required
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            billingData.billing_city ?? ''
                                        }
                                        placeholder="Budapest"
                                        autoComplete="address-level2"
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errors.billing_city}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="billing_address">
                                    Utca, házszám
                                </Label>
                                <Input
                                    id="billing_address"
                                    name="billing_address"
                                    required
                                    className="mt-1 block w-full"
                                    defaultValue={
                                        billingData.billing_address ?? ''
                                    }
                                    placeholder="pl. Kossuth Lajos utca 1."
                                    autoComplete="street-address"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.billing_address}
                                />
                            </div>

                            <Button disabled={processing}>Mentés</Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

Billing.layout = {
    breadcrumbs: [
        {
            title: 'Számlázási adatok',
            href: edit(),
        },
    ],
};
