import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';
import { categories, subCategories } from './config.js'; // Categories for mandatory, discretionary
import { getPlayerData, saveToLocalStorage} from "./dashboard.js";
import playerDataManager from "./playerDataManager.js";


// Function to process transactions from Google Sheets
export async function generateCashflowData() {
    // Initialise Function Variables to be exported
    let dAvgIncome = null
    let dAvgSpending_Mandatory = null
    let dAvgSpending_Supplementary = null
    let dAvgSpending_Discretionary = null
    let dAvgSpending_Discretionary_Growth = null
    let dAvgSpending_Discretionary_Wants = null
    let dAvgSpending_Discretionary_Needs = null
    let dAvgBalance = null
    
    // Get Local Storage Variables
    let playerData = playerDataManager.get();

    // Retreive PlayerData variables
    let availableTransactionStartDate = null
        if (playerData.financeSummary.transactionStartDate){
            const [day, month, year] = playerData.financeSummary.transactionStartDate.split("/");
            availableTransactionStartDate = new Date(`${year}-${month}-${day}`);  
        } else {
            availableTransactionStartDate = playerData.startDate ? playerData.startDate.toDate() : null;
            if (!availableTransactionStartDate) {
                console.error("Start date is missing!");
                return;
            }
        }

    const transactionsStartDate = availableTransactionStartDate    
    const daysSinceFirstTransaction = parseFloat((new Date() - new Date(transactionsStartDate)) / (1000 * 60 * 60 * 24));

    const incomeToDate = playerData.financeSummary.income || 0;
    const mandatorySpendingToDate = playerData.financeSummary.expensesByCategory?.[categories.mandatory]  || 0;
    const supplementarySpendingToDate = playerData.financeSummary.expensesByCategory?.[categories.supplementary] || 0;

    const discretionarySpendingToDate_Growth = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][0]]
    const discretionarySpendingToDate_Wants = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][1]]
    const discretionarySpendingToDate_Needs = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][2]]
    const discretionarySpendingToDate_Unallocated = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][3]]
        // Adjusted 
        const discretionarySpendingToDate_ADJ_Growth = discretionarySpendingToDate_Growth + (discretionarySpendingToDate_Unallocated * 0.2)
        const discretionarySpendingToDate_ADJ_Wants = discretionarySpendingToDate_Wants + (discretionarySpendingToDate_Unallocated * 0.3)
        const discretionarySpendingToDate_ADJ_Needs = discretionarySpendingToDate_Needs + (discretionarySpendingToDate_Unallocated * 0.5)
    
    // Function output variables - Averages
    dAvgIncome = incomeToDate / daysSinceFirstTransaction
    dAvgSpending_Mandatory = mandatorySpendingToDate / daysSinceFirstTransaction
    dAvgSpending_Supplementary = supplementarySpendingToDate / daysSinceFirstTransaction   
    dAvgSpending_Discretionary_Growth = discretionarySpendingToDate_ADJ_Growth / daysSinceFirstTransaction
    dAvgSpending_Discretionary_Wants = discretionarySpendingToDate_ADJ_Wants / daysSinceFirstTransaction 
    dAvgSpending_Discretionary_Needs = discretionarySpendingToDate_ADJ_Needs / daysSinceFirstTransaction  
    dAvgSpending_Discretionary = dAvgSpending_Discretionary_Growth + dAvgSpending_Discretionary_Wants + dAvgSpending_Discretionary_Needs  
    

   const cashflowData = { 
                            dAvgIncome, 
                            dAvgSpending_Mandatory, 
                            dAvgSpending_Supplementary,
                            dAvgSpending_Discretionary,
                            dAvgSpending_Discretionary_Growth,
                            dAvgSpending_Discretionary_Wants,
                            dAvgSpending_Discretionary_Needs 
                        }

                        

 
    playerDataManager.update({
        financeSummary: {cashflowData: cashflowData},
    });

    return playerDataManager.get() 

}

export async function generateHudData() {

    // Initialise Variables
    let dContributionsTarget_Avatar = null
    let dContributionsTarget_Community = null
    let dContributionsTarget_IGC = null
    let dSpendingCap_Growth = null
    let dSpendingCap_Wants = null
    let dSpendingCap_Needs = null
    let totalAccumulatedResource_Growth = null
    let totalAccumulatedResource_Wants = null
    let totalAccumulatedResource_Needs = null
    let availableResource_Growth = null
    let availableResource_Wants = null
    let availableResource_Needs = null
    let availableResource_Total = null
    let storedDays_Growth = null
    let storedDays_Wants = null
    let storedDays_Needs = null

    const growthAllocation = 0.2
    const wantsAllocation = 0.3
    const needsAllocation = 0.5 

    // Get Local Storage Variables
    let playerData = playerDataManager.get();
    const cashflowData = playerData.financeSummary.cashflowData
    
    // Retreive PlayerData variables
    let availableTransactionStartDate = null
        if (playerData.financeSummary.transactionStartDate){
            const [day, month, year] = playerData.financeSummary.transactionStartDate.split("/");
            availableTransactionStartDate = new Date(`${year}-${month}-${day}`);  
        } else {
            availableTransactionStartDate = playerData.startDate ? playerData.startDate.toDate() : null;
            if (!availableTransactionStartDate) {
                console.error("Start date is missing!");
                return;
            }
        }

    const transactionsStartDate = availableTransactionStartDate    
    const daysSinceFirstTransaction = parseFloat((new Date() - new Date(transactionsStartDate)) / (1000 * 60 * 60 * 24));
    
    const discretionarySpendingToDate_Growth = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][0]]
    const discretionarySpendingToDate_Wants = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][1]]
    const discretionarySpendingToDate_Needs = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][2]]
    const discretionarySpendingToDate_Unallocated = playerData.financeSummary.expensesByCategory?.[categories.discretionary][subCategories[categories.discretionary][3]]
        // Adjusted 
        const discretionarySpendingToDate_ADJ_Growth = discretionarySpendingToDate_Growth + (discretionarySpendingToDate_Unallocated * 0.2)
        const discretionarySpendingToDate_ADJ_Wants = discretionarySpendingToDate_Wants + (discretionarySpendingToDate_Unallocated * 0.3)
        const discretionarySpendingToDate_ADJ_Needs = discretionarySpendingToDate_Needs + (discretionarySpendingToDate_Unallocated * 0.5)
    
    // Retreive CashflowData variables
    const dAvgIncome = cashflowData.dAvgIncome
    const dAvgSpending_Mandatory = cashflowData.dAvgSpending_Mandatory
    const dAvgSpending_Supplementary = cashflowData.dAvgSpending_Supplementary

    // Function output variables
    const discretionaryPool = dAvgIncome - dAvgSpending_Mandatory - dAvgSpending_Supplementary
    dContributionsTarget_Avatar = (60 / 30.44) + (discretionaryPool * 0.075) || 0;
    dContributionsTarget_Community = (discretionaryPool * 0.025) || 0;
    dContributionsTarget_IGC = (discretionaryPool * 0.2) || 0;

    const personalDiscretionaryPool = discretionaryPool - (dContributionsTarget_Avatar + dContributionsTarget_Community + dContributionsTarget_IGC)  
    
    let modeMultiplier = 1
    let mode = playerData.hudData.mode
    console.log(playerData.hudData.mode)
    switch(mode) {
        case 'Weekly':
            modeMultiplier = 7;
          break;
        case 'Monthly':
            modeMultiplier = 30.44;
          break;
        default:
            modeMultiplier = 1;
      }

      console.log("Mode Multiplier: " + modeMultiplier)


    dSpendingCap_Growth = personalDiscretionaryPool * growthAllocation * modeMultiplier
    dSpendingCap_Wants = personalDiscretionaryPool * wantsAllocation * modeMultiplier 
    dSpendingCap_Needs = personalDiscretionaryPool * needsAllocation * modeMultiplier 
    
    const dRegenRate_Growth = personalDiscretionaryPool * growthAllocation
    const dRegenRate_Wants = personalDiscretionaryPool * wantsAllocation
    const dRegenRate_Needs = personalDiscretionaryPool * needsAllocation
    
    totalAccumulatedResource_Growth = dSpendingCap_Growth + (dRegenRate_Growth * daysSinceFirstTransaction) - discretionarySpendingToDate_ADJ_Growth
    totalAccumulatedResource_Wants = dSpendingCap_Wants + (dRegenRate_Wants * daysSinceFirstTransaction) - discretionarySpendingToDate_ADJ_Wants
    totalAccumulatedResource_Needs = dSpendingCap_Needs + (dRegenRate_Needs * daysSinceFirstTransaction) - discretionarySpendingToDate_ADJ_Needs  
    
    availableResource_Growth = Math.abs(totalAccumulatedResource_Growth % dSpendingCap_Growth)
    availableResource_Wants = Math.abs(totalAccumulatedResource_Wants % dSpendingCap_Wants)
    availableResource_Needs = Math.abs(totalAccumulatedResource_Needs % dSpendingCap_Needs)
    availableResource_Total = availableResource_Growth + availableResource_Wants + availableResource_Needs

    storedDays_Growth = parseInt(totalAccumulatedResource_Growth / dSpendingCap_Growth)
    storedDays_Wants = parseInt(totalAccumulatedResource_Wants / dSpendingCap_Wants)
    storedDays_Needs = parseInt(totalAccumulatedResource_Needs / dSpendingCap_Needs)

    let hudData = { 
        dContributionsTarget_Avatar, 
        dContributionsTarget_Community,
        dContributionsTarget_IGC,
        dSpendingCap_Growth, 
        dSpendingCap_Wants,
        dSpendingCap_Needs,
        dRegenRate_Growth,
        dRegenRate_Wants,
        dRegenRate_Needs,
        totalAccumulatedResource_Growth,
        totalAccumulatedResource_Wants,
        totalAccumulatedResource_Needs,
        availableResource_Growth,
        availableResource_Wants,
        availableResource_Needs,
        availableResource_Total,
        storedDays_Growth,
        storedDays_Wants,
        storedDays_Needs
    }



    playerDataManager.update({
        hudData: hudData,
    });

   
    return playerDataManager.get() 

}

export async function generateAvatarData() {

    // Get Local Storage Variables
    let playerData = playerDataManager.get();

    let hudData = playerData.hudData
    let avatarData = playerData.avatarData

        const monthsSinceStart = playerData.monthsSinceStart
        const dailyTargetContribution = hudData.dContributionsTarget_Avatar ? hudData.dContributionsTarget_Avatar : 1

        const totalContributed_Avatar = avatarData.avatarContribution ? avatarData.avatarContribution : 0;
       

        const maxContribution_Avatar = dailyTargetContribution * 30.44 * monthsSinceStart
        const contributionPercent_Avatar = Math.max(Math.min(totalContributed_Avatar / maxContribution_Avatar, 1.5),0)

        const contributionLevel = Math.min(1 + parseInt(totalContributed_Avatar / (dailyTargetContribution * 30.44)), 60 + parseInt(maxContribution_Avatar / (dailyTargetContribution * 30.44)))

        const contributionAmountToNextLevel = (dailyTargetContribution * 30.44) - totalContributed_Avatar % (dailyTargetContribution * 30.44)
        
  
  
        avatarData = {
            ...avatarData,
            maxContribution_Avatar: Math.round(maxContribution_Avatar),
            contributionPercent_Avatar: contributionPercent_Avatar,
            contributionLevel: contributionLevel,
            contributionAmountToNextLevel: contributionAmountToNextLevel,
        };



    playerDataManager.update({
        avatarData: avatarData,
    });

   
    return playerDataManager.get() 
}

 export async function getAvatarStatData(baseAvatarData){

    // Get Local Storage Variables
 
    const playerData = playerDataManager.get()
    
    
    const avatarData = playerData.avatarData
  
 
    const empowerMultiplier = avatarData.avatarEmpowerLevel * 0.1
    const hudMultiplier_Health = (playerData.hudData.storedDays_Growth * 0.01)
    const hudMultiplier_Mana = (playerData.hudData.storedDays_Wants * 0.01)
    const hudMultiplier_Stamina = (playerData.hudData.storedDays_Stamina * 0.01)
    const chargeMultiplier = avatarData.contributionPercent_Avatar
    // Skill Tree Stub
    const empowerMultiplier_HealthModifier = 1 + (playerData.attributePoints.resilience * 0.01)
    const empowerMultiplier_ManaModifier = 1 + (playerData.attributePoints.focus * 0.01)
    const empowerMultiplier_StaminaModifier = 1 + (playerData.attributePoints.adaptability * 0.01)

    const hudMultiplier_HealthModifier = 1 + (playerData.attributePoints.resilience * 0.01)
    const hudMultiplier_ManaModifier = 1 + (playerData.attributePoints.focus * 0.01)
    const hudMultiplier_StaminaModifier = 1 + (playerData.attributePoints.adaptability * 0.01)

    const chargeMultiplier_HealthModifier = 1 + (playerData.attributePoints.resilience * 0.01)
    const chargeMultiplier_ManaModifier = 1 + (playerData.attributePoints.focus * 0.01)
    const chargeMultiplier_StaminaModifier = 1 + (playerData.attributePoints.adaptability * 0.01)
    

    // Health
        let total = baseAvatarData.health.base

        baseAvatarData.health.empower = baseAvatarData.health.base * (empowerMultiplier * empowerMultiplier_HealthModifier)

        total += baseAvatarData.health.empower

        let hudMultiplier = 1 + (hudMultiplier_Health * hudMultiplier_HealthModifier)

        total *= hudMultiplier

        baseAvatarData.health.hud = total - (baseAvatarData.health.base + baseAvatarData.health.empower)

    // Mana
        total = baseAvatarData.mana.base

        baseAvatarData.mana.empower = baseAvatarData.mana.base * (empowerMultiplier * empowerMultiplier_ManaModifier)

        total += baseAvatarData.mana.empower

        hudMultiplier = 1 + (hudMultiplier_Mana * hudMultiplier_ManaModifier) 

        total *= hudMultiplier

        baseAvatarData.mana.hud = total - (baseAvatarData.mana.base + baseAvatarData.mana.empower)
   
    // Stamina
    total = baseAvatarData.stamina.base

    baseAvatarData.stamina.empower = baseAvatarData.stamina.base * (empowerMultiplier * empowerMultiplier_StaminaModifier)

    total += baseAvatarData.stamina.empower


    hudMultiplier = 1 + (hudMultiplier_Stamina * hudMultiplier_StaminaModifier) 

    total *= hudMultiplier

    baseAvatarData.stamina.hud = total - (baseAvatarData.stamina.base + baseAvatarData.stamina.empower)

    // Charge
    if (baseAvatarData.lowestStat == "Health"){
        baseAvatarData.health.charge = 1 * (chargeMultiplier * chargeMultiplier_HealthModifier)
    } else if (baseAvatarData.lowestStat == "Mana"){
        baseAvatarData.mana.charge = 1 * (chargeMultiplier * chargeMultiplier_ManaModifier)
    } else {
        baseAvatarData.stamina.charge = 1 * (chargeMultiplier * chargeMultiplier_StaminaModifier)
    }

 


    return baseAvatarData
}





