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

    // Test 1: Check Supabase connection
    testResults.push('Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('profiles').select('count');
      if (error) {
        testResults.push(`❌ Profiles query failed: ${error.message}`);
      } else {
        testResults.push(`✅ Database connected successfully`);
      }
    } catch (err) {
      testResults.push(`❌ Connection error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Test 2: Check auth service
    testResults.push('Testing auth service...');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        testResults.push(`❌ Auth service error: ${error.message}`);
      } else {
        testResults.push(`✅ Auth service responding`);
      }
    } catch (err) {
      testResults.push(`❌ Auth error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Test 3: Check signup flow
    testResults.push('Testing signup capability...');
    try {
      const testEmail = `test${Date.now()}@example.com`;
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456',
        options: {
          data: { display_name: 'Test User' }
        }
      });
      
      if (error) {
        testResults.push(`❌ Signup test failed: ${error.message}`);
      } else if (data.user) {
        testResults.push(`✅ Signup flow working`);
        // Clean up test user
        await supabase.auth.signOut();
      }
    } catch (err) {
      testResults.push(`❌ Signup error: ${err instanceof Error ? err.message : 'Unknown'}`);
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
          <p className="text-muted-foreground">Test database and authentication services</p>
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
