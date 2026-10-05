export async function withMinDuration<T>(
    work: Promise<T>,
    ms = 2000,
): Promise<T> {
    const [result] = await Promise.all([
        work,
        new Promise((resolve) => setTimeout(resolve, ms)),
    ]);

    return result;
}
