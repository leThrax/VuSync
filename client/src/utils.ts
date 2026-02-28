export function extractPlaylistId(url: string): string | null {
    const match = url.match(/[?&]list=([^&#]+)/)
    return match ? match[1] : null
}

export function extractVideoId(url: string): string | null {
    const patterns = [
        /[?&]v=([^&#]+)/,
        /youtu\.be\/([^&#?/]+)/,
        /\/embed\/([^&#?/]+)/,
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}
