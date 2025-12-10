import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function HealthCheck() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const runTests = async () => {
    setTesting(true);
    const testResults: string[] = [];

    // Test 1: Check Backend Connection
    testResults.push('Testing Backend connection...');
    try {
      // Simple ping to an endpoint, e.g. /events or just check if we get a response
      // using a purposely failing auth call or a public endpoint if available.
      // For now, let's try to hit the API root or a known endpoint.
      // Since most valid endpoints are protected, we might get 401, which actually confirms the API is UP.

      await api.get('/events').catch(err => {
        if (err.response?.status === 401) {
          return; // This is good, it means server is reachable
        }
        throw err;
      });
      testResults.push(`✅ Backend connected successfully`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        testResults.push(`✅ Backend connected (Protected routes responding 401)`);
      } else {
        testResults.push(`❌ Connection error: ${err.message || 'Unknown error'}`);
      }
    }

    // Test 2: Check Auth Endpoint
    testResults.push('Testing Auth service...');
    try {
      await api.get('/auth/me');
      testResults.push(`✅ Auth service reachable`);
    } catch (err: any) {
      // 401 is expected if not logged in, but means service is up
      if (err.response?.status === 401) {
        testResults.push(`✅ Auth service reachable (User not logged in)`);
      } else {
        testResults.push(`❌ Auth service error: ${err.message}`);
      }
    }

    setResults(testResults);
    setTesting(false);

    toast.info('Health check complete', {
      description: 'Check results below'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">System Health Check</h1>
          <p className="text-muted-foreground">Test backend API services</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card">
          <Button
            onClick={runTests}
            disabled={testing}
            className="w-full mb-6"
          >
            {testing ? 'Running tests...' : 'Run Health Check'}
          </Button>

          {results.length > 0 && (
            <div className="bg-background rounded-lg p-4 space-y-2 font-mono text-sm">
              {results.map((result, i) => (
                <div key={i} className="text-foreground">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <a href="/login" className="text-primary hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
