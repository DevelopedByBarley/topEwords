import { Form, Head } from '@inertiajs/react';
import RegisterFields from '@/components/auth/register-fields';
import { store } from '@/routes/register';
import type { RegisterPageProps } from '@/types/auth';

export default function Register({
    inviteOnly = false,
    invite = '',
}: RegisterPageProps) {
    return (
        <>
            <Head title="Regisztráció" />
            <Form
                action={store.url()}
                method="post"
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <RegisterFields
                        processing={processing}
                        errors={errors}
                        inviteOnly={inviteOnly}
                        invite={invite}
                    />
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Fiók létrehozása',
    description: 'Add meg az adataidat a regisztrációhoz',
    wide: true,
};
