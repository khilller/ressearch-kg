# Knowledge Graph Builder

A Next.js application that extracts entities and relationships from PDF documents using LangChain and OpenAI, deployed on Cloudflare Workers.

## Features

- Upload multiple PDF documents
- AI-powered entity and relationship suggestions
- Customizable entity and relationship types
- Knowledge graph extraction using LangChain
- Server-side processing with Next.js App Router
- Optimized for Cloudflare Workers deployment

## Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.local.example .env.local
   # Add your OpenAI API key
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Preview on Workers Runtime**
   ```bash
   npm run preview
   ```

5. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

## Configuration

### Cloudflare Workers Setup

The app is configured to run on Cloudflare Workers with Node.js compatibility:

- `nodejs_compat` flag enabled for Node.js API support
- OpenNext adapter for Next.js compatibility
- Server actions for PDF processing and AI integration

### Environment Variables

Add these to your Cloudflare Workers environment:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Architecture

### AI Processing Pipeline

1. **Document Upload**: PDF files uploaded via client
2. **AI Suggestions**: First LLM call to suggest relevant entities/relationships
3. **Graph Extraction**: LangChain LLMGraphTransformer processes documents
4. **Visualization**: Results displayed in structured format

### Tech Stack

- **Frontend**: Next.js 14 with App Router, React, Tailwind CSS
- **Backend**: Next.js Server Actions, LangChain, OpenAI API
- **Deployment**: Cloudflare Workers with OpenNext adapter
- **Processing**: pdf-parse for text extraction, structured output with Zod

## Usage

1. Upload PDF documents (biotech patents, research papers, etc.)
2. Describe your research focus
3. Get AI suggestions for entities and relationships
4. Customize or add your own entity/relationship types
5. Process documents to extract knowledge graph
6. View extracted entities and relationships

## Limitations

- PDF-only document support
- Requires OpenAI API key
- Processing time depends on document size and complexity
- Graph visualization is currently text-based (can be enhanced with D3.js/vis.js)

## Future Enhancements

- Interactive graph visualization
- Vector database integration for semantic search
- Chat interface to query the knowledge graph
- Support for additional document formats
- Export capabilities (JSON, CSV, GraphML)

## License

MIT
