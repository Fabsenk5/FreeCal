import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function HealthCheck() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const runTests = async () => {
    setTesting(true);
    const testResults: string[] = [];

    // Test 1: Check Supabase Connection
    testResults.push('Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      testResults.push(`✅ Supabase connected successfully`);
    } catch (err: any) {
      testResults.push(`❌ Supabase connection error: ${err.message || 'Unknown error'}`);
    }

    // Test 2: Check Auth Service
    testResults.push('Testing Auth service...');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      testResults.push(data.session
        ? `✅ Auth service: Logged in as ${data.session.user.email}`
        : `✅ Auth service reachable (not logged in)`
      );
    } catch (err: any) {
      testResults.push(`❌ Auth service error: ${err.message}`);
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
          <p className="text-muted-foreground">Test Supabase services</p>
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
