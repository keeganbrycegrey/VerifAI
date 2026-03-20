const BASE_URL = "RAILWAYURL"

export async function getDashboardFeed() {
    const res = await fetch(`${BASE_URL}/dashboard/feed`)
    if (!res.ok) throw new Error(`feed error: ${res.status}`)
    return res.json()
}

export async function getTrendingClaims() {
    const res = await fetch(`${BASE_URL}/dashboard/trending`)
    if (!res.ok) throw new Error(`trending error: ${res.status}`)
    return res.json()
}

export async function getCoverage() {
    const res = await fetch(`${BASE_URL}/dashboard/coverage`)
    if (!res.ok) throw new Error(`coverage error: ${res.status}`)
    return res.json()
}

export async function getDailyUsage() {
    const res = await fetch(`${BASE_URL}/dashboard/daily`)
    if (!res.ok) throw new Error(`daily error: ${res.status}`)
    return res.json()
}