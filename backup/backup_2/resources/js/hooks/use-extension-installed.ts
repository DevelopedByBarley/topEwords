import { useEffect, useState } from 'react';

export function useExtensionInstalled() {
    const [installed, setInstalled] = useState<boolean | null>(null);

    useEffect(() => {
        setInstalled(localStorage.getItem('topwords_ext_installed') === '1');
    }, []);

    return installed;
}
