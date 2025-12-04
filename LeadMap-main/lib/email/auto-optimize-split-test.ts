/**
 * Auto-Optimize Split Test
 * Automatically selects winning variant based on campaign settings
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Auto-optimize split test for a campaign step
 * Checks if enough data has been collected and selects winner
 */
export async function autoOptimizeSplitTest(
  supabase: any,
  campaignId: string,
  stepId: string
): Promise<{ optimized: boolean; winnerVariantId?: string; reason?: string }> {
  try {
    // Get campaign settings
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('auto_optimize_split_test, split_test_winning_metric')
      .eq('id', campaignId)
      .single()

    if (!campaign || !campaign.auto_optimize_split_test) {
      return { optimized: false, reason: 'Auto-optimize not enabled' }
    }

    // Get split test configuration
    const { data: splitTest } = await supabase
      .from('campaign_step_split_tests')
      .select('*')
      .eq('step_id', stepId)
      .eq('is_enabled', true)
      .single()

    if (!splitTest) {
      return { optimized: false, reason: 'No split test found' }
    }

    // Check if winner already selected
    if (splitTest.winner_variant_id) {
      return { optimized: false, reason: 'Winner already selected' }
    }

    // Get analytics for all variants
    const { data: analytics } = await supabase
      .from('split_test_analytics')
      .select('*')
      .eq('split_test_id', splitTest.id)

    if (!analytics || analytics.length < 2) {
      return { optimized: false, reason: 'Not enough variants for comparison' }
    }

    // Check minimum requirements
    const minRecipients = splitTest.min_recipients_per_variant || 100
    const minTimeHours = splitTest.min_time_hours || 24
    const testStartTime = splitTest.started_at ? new Date(splitTest.started_at) : new Date()
    const hoursSinceStart = (Date.now() - testStartTime.getTime()) / (1000 * 60 * 60)

    // Check if minimum time has passed
    if (hoursSinceStart < minTimeHours) {
      return { optimized: false, reason: `Minimum time (${minTimeHours}h) not reached` }
    }

    // Check if each variant has minimum recipients
    const allHaveMinRecipients = analytics.every((a: any) => a.total_sent >= minRecipients)
    if (!allHaveMinRecipients) {
      return { optimized: false, reason: `Not all variants have minimum ${minRecipients} recipients` }
    }

    // Determine winner based on metric
    const winningMetric = campaign.split_test_winning_metric || 'open_rate'
    let winner: any = null

    if (winningMetric === 'open_rate') {
      winner = analytics.reduce((best: any, current: any) => 
        (current.open_rate || 0) > (best.open_rate || 0) ? current : best
      )
    } else if (winningMetric === 'click_rate') {
      winner = analytics.reduce((best: any, current: any) => 
        (current.click_rate || 0) > (best.click_rate || 0) ? current : best
      )
    } else if (winningMetric === 'reply_rate') {
      winner = analytics.reduce((best: any, current: any) => 
        (current.reply_rate || 0) > (best.reply_rate || 0) ? current : best
      )
    } else if (winningMetric === 'conversion_rate') {
      winner = analytics.reduce((best: any, current: any) => 
        (current.conversion_rate || 0) > (best.conversion_rate || 0) ? current : best
      )
    }

    if (!winner) {
      return { optimized: false, reason: 'Could not determine winner' }
    }

    // Update split test with winner
    await supabase
      .from('campaign_step_split_tests')
      .update({
        winner_variant_id: winner.variant_id,
        winner_selected_at: new Date().toISOString(),
        winner_selection_method: 'auto'
      })
      .eq('id', splitTest.id)

    // Deactivate non-winning variants
    const { data: allVariants } = await supabase
      .from('campaign_step_variants')
      .select('id')
      .eq('step_id', stepId)
      .eq('is_active', true)

    if (allVariants) {
      const nonWinners = allVariants.filter((v: any) => v.id !== winner.variant_id)
      if (nonWinners.length > 0) {
        await supabase
          .from('campaign_step_variants')
          .update({ is_active: false })
          .in('id', nonWinners.map((v: any) => v.id))
      }
    }

    return {
      optimized: true,
      winnerVariantId: winner.variant_id,
      reason: `Winner selected based on ${winningMetric}`
    }
  } catch (error: any) {
    console.error('Error auto-optimizing split test:', error)
    return { optimized: false, reason: error.message || 'Unknown error' }
  }
}

