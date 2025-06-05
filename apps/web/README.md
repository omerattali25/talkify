# Talkify Web Frontend

This is the web frontend for the Talkify chat application, built with React, TypeScript, and Vite.

## Features

- Modern React with TypeScript
- Vite for fast development and building
- React Query for efficient data fetching and caching
- Axios for API communication
- Type-safe API integration

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Running Talkify backend API

### Environment Setup

1. Create a `.env` file in the root directory with the following content:
```env
VITE_API_URL=http://localhost:8080/api
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Route pages
├── contexts/      # React contexts
├── lib/           # Utilities and API client
│   ├── api.ts     # API client implementation
│   ├── hooks.ts   # React Query hooks
│   └── query.tsx  # React Query provider
├── types/         # TypeScript type definitions
└── assets/        # Static assets
```

### API Integration

The frontend integrates with the Talkify backend API using:

1. **API Client** (`src/lib/api.ts`)
   - Type-safe API methods
   - Automatic error handling
   - Authentication header management

2. **React Query Hooks** (`src/lib/hooks.ts`)
   - Data fetching and caching
   - Optimistic updates
   - Real-time synchronization

3. **Type Definitions** (`src/types/api.ts`)
   - Shared types with backend
   - Full type safety
   - IntelliSense support

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
