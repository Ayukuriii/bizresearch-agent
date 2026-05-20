// ============================================================
// Demo Scenarios
//
// Curated prompts that showcase all three agent tools:
//   - web_search   : retrieves current data
//   - scrape        : pulls full page content
//   - summarizer    : condenses large text into structured output
//
// Each scenario is designed to complete in 3–6 iterations,
// which is a good demo length — enough to show reasoning
// without being slow.
// ============================================================

export interface DemoScenario {
    id: string;
    title: string;
    description: string;
    prompt: string;
    // Tags shown as small badges on the card
    tags: string[];
    // Estimated iterations — sets client expectations during demo
    estimatedIterations: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
    {
        id: 'competitor-analysis',
        title: 'Competitor Analysis',
        description: 'Compare two competing companies across product, pricing, and market position.',
        prompt:
            'Do a competitor analysis between Notion and Obsidian. Cover: target audience, ' +
            'core features, pricing model, and which type of user each is best suited for.',
        tags: ['web_search', 'summarizer'],
        estimatedIterations: '4–5 iterations',
    },
    {
        id: 'market-overview',
        title: 'Market Overview',
        description: 'Get a structured overview of an industry with key players and trends.',
        prompt:
            'Give me a market overview of the AI coding assistant space in 2025. ' +
            'Include the main players, their differentiation, and where the market is heading.',
        tags: ['web_search', 'scrape', 'summarizer'],
        estimatedIterations: '5–6 iterations',
    },
    {
        id: 'company-profile',
        title: 'Company Deep Dive',
        description: 'Research a specific company — funding, product, team, and recent news.',
        prompt:
            'Research Supabase: what they do, their funding history, current product offering, ' +
            'pricing tiers, and any major announcements in the last 6 months.',
        tags: ['web_search', 'scrape', 'summarizer'],
        estimatedIterations: '5–6 iterations',
    },
    {
        id: 'pricing-research',
        title: 'Pricing Research',
        description: 'Benchmark pricing across multiple tools in the same category.',
        prompt:
            'Compare the pricing models of Vercel, Netlify, and Render for a team of 3 developers ' +
            'deploying a full-stack web app. Which offers the best value at early-stage scale?',
        tags: ['web_search', 'scrape'],
        estimatedIterations: '4–5 iterations',
    },
    {
        id: 'tech-stack-research',
        title: 'Tech Stack Research',
        description: 'Evaluate technology choices for a specific use case.',
        prompt:
            'I am building a real-time collaborative document editor. Research and compare ' +
            'Liveblocks, PartyKit, and Yjs + WebSocket as the sync layer. ' +
            'Cover: ease of integration, pricing, scalability, and open-source friendliness.',
        tags: ['web_search', 'scrape', 'summarizer'],
        estimatedIterations: '5–6 iterations',
    },
];