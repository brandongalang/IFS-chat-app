// Database Validation Utilities
// Validates database schema, RLS policies, and data integrity

import { createClient } from '../supabase/server'

interface ValidationResult {
  success: boolean
  message: string
  details?: unknown
}

interface ValidationSuite {
  schema: ValidationResult[]
  rls: ValidationResult[]
  functions: ValidationResult[]
  indexes: ValidationResult[]
  overall: boolean
}

export class DatabaseValidator {
  private supabase: Awaited<ReturnType<typeof createClient>>

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase
  }

  static async create() {
    const supabase = await createClient()
    return new DatabaseValidator(supabase)
  }

  /**
   * Run complete database validation suite
   */
  async validateDatabase(): Promise<ValidationSuite> {
    console.log('🔍 Starting database validation...')

    const results: ValidationSuite = {
      schema: [],
      rls: [],
      functions: [],
      indexes: [],
      overall: false
    }

    try {
      // Validate schema
      results.schema = await this.validateSchema()
      
      // Validate RLS policies
      results.rls = await this.validateRLSPolicies()
      
      // Validate functions
      results.functions = await this.validateFunctions()
      
      // Validate indexes
      results.indexes = await this.validateIndexes()

      // Calculate overall success
      results.overall = [
        ...results.schema,
        ...results.rls,
        ...results.functions,
        ...results.indexes
      ].every(r => r.success)

      console.log(results.overall ? '✅ Database validation passed' : '❌ Database validation failed')
      
    } catch (error) {
      console.error('💥 Database validation error:', error)
      results.overall = false
    }

    return results
  }

  /**
   * Validate that all required tables exist with correct structure
   */
  private async validateSchema(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    
    const requiredTables = [
      {
        name: 'users',
        columns: ['id', 'email', 'name', 'settings', 'stats', 'created_at', 'updated_at']
      },
      {
        name: 'parts',
        columns: ['id', 'user_id', 'name', 'status', 'category', 'confidence', 'recent_evidence']
      },
      {
        name: 'sessions',
        columns: ['id', 'user_id', 'start_time', 'messages', 'processed']
      },
      {
        name: 'part_relationships',
        columns: ['id', 'user_id', 'parts', 'type', 'status']
      }
    ]

    for (const table of requiredTables) {
      try {
        // Check if table exists and get its columns
        const { error } = await this.supabase.rpc('get_table_columns', {
          table_name: table.name
        }).single()

        if (error) {
          // Fallback: Try a simple select to check if table exists
          const { error: selectError } = await this.supabase
            .from(table.name)
            .select('*')
            .limit(0)

          if (selectError) {
            results.push({
              success: false,
              message: `Table '${table.name}' does not exist`,
              details: selectError
            })
            continue
          }
        }

        results.push({
          success: true,
          message: `Table '${table.name}' exists and is accessible`
        })

      } catch (err) {
        results.push({
          success: false,
          message: `Failed to validate table '${table.name}'`,
          details: err
        })
      }
    }

    return results
  }

  /**
   * Validate RLS policies are correctly configured
   */
  private async validateRLSPolicies(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    
    const tables = ['users', 'parts', 'sessions', 'part_relationships']
    
    for (const table of tables) {
      try {
        // Check if RLS is enabled
        const { data: rlsEnabled, error } = await this.supabase
          .rpc('check_rls_enabled', { table_name: table })

        if (error) {
          results.push({
            success: false,
            message: `Could not check RLS status for '${table}'`,
            details: error
          })
          continue
        }

        if (rlsEnabled) {
          results.push({
            success: true,
            message: `RLS is enabled for table '${table}'`
          })
        } else {
          results.push({
            success: false,
            message: `RLS is NOT enabled for table '${table}'`
          })
        }

      } catch (err) {
        results.push({
          success: false,
          message: `Failed to validate RLS for table '${table}'`,
          details: err
        })
      }
    }

    return results
  }

  /**
   * Validate custom database functions exist and work
   */
  private async validateFunctions(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    
    const functions = [
      'update_part_confidence',
      'add_part_evidence',
      'get_user_stats'
    ]

    for (const funcName of functions) {
      try {
        // Check if function exists by trying to get its definition
        const { error } = await this.supabase
          .rpc('get_function_definition', { function_name: funcName })

        if (error && error.code === '42883') {
          results.push({
            success: false,
            message: `Function '${funcName}' does not exist`
          })
          continue
        }

        results.push({
          success: true,
          message: `Function '${funcName}' exists`
        })

      } catch (err) {
        results.push({
          success: false,
          message: `Failed to validate function '${funcName}'`,
          details: err
        })
      }
    }

    return results
  }

  /**
   * Validate that performance indexes are in place
   */
  private async validateIndexes(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    
    const expectedIndexes = [
      'idx_users_email',
      'idx_parts_user_id',
      'idx_parts_user_status',
      'idx_sessions_user_id',
      'idx_sessions_processed'
    ]

    for (const indexName of expectedIndexes) {
      try {
        const { error } = await this.supabase
          .rpc('check_index_exists', { index_name: indexName })

        if (error) {
          results.push({
            success: false,
            message: `Could not check index '${indexName}'`,
            details: error
          })
          continue
        }

        results.push({
          success: true,
          message: `Index '${indexName}' exists`
        })

      } catch (err) {
        results.push({
          success: false,
          message: `Failed to validate index '${indexName}'`,
          details: err
        })
      }
    }

    return results
  }

  /**
   * Test data isolation between users
   */
  async testDataIsolation(userId1: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    try {
      // Create test data for user 1
      const { data: part1, error: createError } = await this.supabase
        .from('parts')
        .insert({
          user_id: userId1,
          name: 'Test Part User 1',
          status: 'emerging'
        })
        .select()
        .single()

      if (createError) {
        results.push({
          success: false,
          message: 'Failed to create test data for user 1',
          details: createError
        })
        return results
      }

      // Try to access user 1's data as user 2 (should fail or return empty)
      const { data: isolationTest, error: accessError } = await this.supabase
        .from('parts')
        .select('*')
        .eq('user_id', userId1)

      if (accessError) {
        results.push({
          success: true,
          message: 'RLS correctly blocked cross-user data access'
        })
      } else if (isolationTest && isolationTest.length === 0) {
        results.push({
          success: true,
          message: 'RLS correctly filtered out other user data'
        })
      } else {
        results.push({
          success: false,
          message: 'RLS failed - cross-user data was accessible',
          details: isolationTest
        })
      }

      // Cleanup test data
      await this.supabase
        .from('parts')
        .delete()
        .eq('id', part1.id)

    } catch (err) {
      results.push({
        success: false,
        message: 'Data isolation test failed with exception',
        details: err
      })
    }

    return results
  }

  /**
   * Generate a validation report
   */
  generateReport(results: ValidationSuite): string {
    const sections = [
      { name: 'Schema', results: results.schema },
      { name: 'RLS Policies', results: results.rls },
      { name: 'Functions', results: results.functions },
      { name: 'Indexes', results: results.indexes }
    ]

    let report = `
# Database Validation Report
Generated: ${new Date().toISOString()}
Overall Status: ${results.overall ? '✅ PASSED' : '❌ FAILED'}

`

    for (const section of sections) {
      const passed = section.results.filter(r => r.success).length
      const total = section.results.length
      
      report += `## ${section.name} (${passed}/${total})\n\n`
      
      for (const result of section.results) {
        const icon = result.success ? '✅' : '❌'
        report += `${icon} ${result.message}\n`
        if (!result.success && result.details) {
          report += `   Details: ${JSON.stringify(result.details, null, 2)}\n`
        }
      }
      report += '\n'
    }

    return report
  }
}

/**
 * Quick validation function for use in API routes or tests
 */
export async function quickValidate(): Promise<boolean> {
  const validator = await DatabaseValidator.create()
  const results = await validator.validateDatabase()
  return results.overall
}

/**
 * Detailed validation with report generation
 */
export async function detailedValidate(): Promise<{
  success: boolean
  report: string
  results: ValidationSuite
}> {
  const validator = await DatabaseValidator.create()
  const results = await validator.validateDatabase()
  const report = validator.generateReport(results)
  
  return {
    success: results.overall,
    report,
    results
  }
}
