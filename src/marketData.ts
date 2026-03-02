export async function fetchMarketData(apiUrl: string) {
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}