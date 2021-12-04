import { get } from 'svelte/store'

import { localize } from '../i18n'
import { networkStatus } from '../networkStatus'
import { showAppNotification } from '../notifications'
import type { WalletAccount } from '../typings/wallet'

import { ASSEMBLY_EVENT_ID, SHIMMER_EVENT_ID, STAKING_AIRDROP_TOKENS } from './constants'
import { partiallyStakedAccounts, participationEvents, participationOverview, stakedAccounts } from './stores'
import { ParticipationEvent, StakingAirdrop } from './types'

/**
 * Determines whether an account is currently being staked or not.
 *
 * @method isAccountStaked
 *
 * @param {string} accountId
 *
 * @returns {boolean}
 */
export const isAccountStaked = (accountId: string): boolean => get(stakedAccounts).find((sa) => sa.id === accountId) !== undefined

export const isAccountPartiallyStaked = (accountId: string): boolean =>
    get(partiallyStakedAccounts).find((psa) => psa.id === accountId) !== undefined

const estimateAssemblyReward = (amount: number, currentMilestone: number, endMilestone: number): number => {
    /**
     * NOTE: This represents the amount of ASMB per 1 Mi received every milestone,
     * which is currently 0.000004 ASMB (4 µASMB).
     */
    const multiplier = 0.000004
    const amountMiotas = amount / 1_000_000
    const numMilestones = endMilestone - currentMilestone

    return Math.floor((multiplier * amountMiotas * numMilestones) * 1_000_000) / 1_000_000
}

const estimateShimmerReward = (amount: number, currentMilestone: number, endMilestone: number): number => {
    /**
     * NOTE: This represents the amount of SMR per 1 Mi received every milestone,
     * which is currently 1 SMR.
     */
    const multiplier = 1.0
    const amountMiotas = amount / 1_000_000
    const numMilestones = endMilestone - currentMilestone

    return multiplier * amountMiotas * numMilestones
}

/**
 * Get the corresponding staking participation event data from its airdrop enumeration.
 *
 * @method getStakingEventFromAirdrop
 *
 * @param {StakingAirdrop} airdrop
 *
 * @returns {ParticipationEvent}
 */
export const getStakingEventFromAirdrop = (airdrop: StakingAirdrop): ParticipationEvent => {
    let stakingEventId
    switch (airdrop) {
        case StakingAirdrop.Assembly:
            stakingEventId = ASSEMBLY_EVENT_ID
            break
        case StakingAirdrop.Shimmer:
            stakingEventId = SHIMMER_EVENT_ID
            break
        default:
            break
    }

    return get(participationEvents).find((pe) => pe.eventId === stakingEventId)
}

type AssemblyDenomination = 'µ' | 'm' | ''

const getAssemblyTokenMultiplier = (denomination: AssemblyDenomination): number => {
    switch(denomination) {
        case 'm':
            return 1_000
        case 'µ':
            return 1_000_000
        default:
            return 1
    }
}

const formatStakingAirdropReward = (airdrop: StakingAirdrop, amount: number): string => {
    switch (airdrop) {
        case StakingAirdrop.Assembly: {
            const denomination: AssemblyDenomination =
                amount >= 1.0 ? '' : amount >= 0.001 ? 'm' : 'µ'
            const multiplier = getAssemblyTokenMultiplier(denomination)

            return `${amount * multiplier} ${denomination}${STAKING_AIRDROP_TOKENS[airdrop]}`
        }
        case StakingAirdrop.Shimmer:
            return `${amount} ${STAKING_AIRDROP_TOKENS[airdrop]}`
        default:
            return '0'
    }
}

/**
 * Calculates the reward estimate for a particular staking airdrop.
 *
 * @method estimateStakingAirdropReward
 *
 * @param {StakingAirdrop} airdrop
 * @param {number} amountToStake
 * @param {boolean} formatAmount
 *
 * @returns {number | string}
 */
export const estimateStakingAirdropReward = (airdrop: StakingAirdrop, amountToStake: number, formatAmount: boolean = false): number | string => {
    const stakingEvent = getStakingEventFromAirdrop(airdrop)
    if (!stakingEvent) {
        showAppNotification({
            type: 'error',
            message: localize('error.participation.cannotFindStakingEvent'),
        })

        return formatAmount ? '0' : 0
    }

    /**
     * NOTE: We can use either of these, however since the network status is polled reguarly
     * it will seem more dynamic rather than re-calculating within this function.
     */
    const currentMilestone = get(networkStatus)?.currentMilestone || stakingEvent?.status?.milestoneIndex
    const endMilestone = stakingEvent?.information?.milestoneIndexEnd

    let estimation
    switch (airdrop) {
        case StakingAirdrop.Assembly:
            estimation = estimateAssemblyReward(
                amountToStake, currentMilestone, endMilestone
            )
            break
        case StakingAirdrop.Shimmer:
            estimation = estimateShimmerReward(
                amountToStake, currentMilestone, endMilestone
            )
            break
        default:
            return 0
    }

    return formatAmount ? formatStakingAirdropReward(airdrop, estimation) : estimation
}

export const getStakedFunds = (account: WalletAccount): number => {
    const accountParticipation = get(participationOverview).find((apo) => apo.accountIndex === account?.index)
    console.log('PART: ', accountParticipation)
    if (!accountParticipation) return 0
    else return accountParticipation.shimmerStakedFunds
}

export const getUnstakedFunds = (account: WalletAccount): number => {
    const accountParticipation = get(participationOverview).find((apo) => apo.accountIndex === account?.index)
    if (!accountParticipation) return 0
    else return accountParticipation.shimmerUnstakedFunds
}