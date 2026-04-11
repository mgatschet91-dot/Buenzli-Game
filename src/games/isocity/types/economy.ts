/**
 * IsoCity Economy Types
 */

export interface Stats {
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  tax_income: number;
  tax_income_population: number;
  tax_income_business: number;
  tax_income_property: number;
  building_income: number;
  company_tax_income: number;
  budget_expenses: number;
  budget_cost_police: number;
  budget_cost_fire: number;
  budget_cost_health: number;
  budget_cost_education: number;
  budget_cost_transportation: number;
  budget_cost_parks: number;
  budget_cost_power: number;
  budget_cost_water: number;
  maintenance_expenses: number;
  administration_base_expenses: number;
  civic_overhead_expenses: number;
  utility_overhead_expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
  };
  // Demographie & Arbeitsmarkt
  employed: number;
  unemployed: number;
  unemployment_rate: number;
  workforce: number;
  workforce_rate: number;
  children: number;
  seniors: number;
  students: number;
  social_fund: number;
  social_contribution_rate: number;
  welfare_per_unemployed: number;
  social_fund_income: number;
  social_fund_expenses: number;
  social_expenses: number;
  welfare_coverage: number;
  // Kapazitäts-Daten (Level-skaliert)
  school_capacity: number;
  uni_capacity: number;
  education_overcrowding: number;
  health_capacity: number;
  health_demand: number;
  health_adequacy: number;
  // Energiesystem
  power_production?: number;
  power_consumption?: number;
  power_season_multiplier?: number;
  power_import_units?: number;
  power_import_cost?: number;
  power_import_price_per_unit?: number;
  power_sold_mw?: number;
  power_bought_mw?: number;
  power_production_effective?: number;
  power_balance_effective?: number;
  power_surplus_pct?: number;
  power_available_to_sell?: number;
  power_buffer_mw?: number;
  power_buffer_pct?: number;
  // Wassersystem
  water_production?: number;
  water_consumption?: number;
  water_balance?: number;
  // Zone demand & building counts (for growth debug panel)
  demand_residential?: number;
  demand_commercial?: number;
  demand_industrial?: number;
  zones_residential?: number;
  zones_commercial?: number;
  zones_industrial?: number;
  buildings_residential?: number;
  buildings_commercial?: number;
  buildings_industrial?: number;
}

export interface BudgetCategory {
  name: string;
  funding: number;
  cost: number;
}

export interface Budget {
  police: BudgetCategory;
  fire: BudgetCategory;
  health: BudgetCategory;
  education: BudgetCategory;
  transportation: BudgetCategory;
  parks: BudgetCategory;
  power: BudgetCategory;
  water: BudgetCategory;
}

export interface CityEconomy {
  population: number;
  jobs: number;
  income: number;
  expenses: number;
  happiness: number;
  lastCalculated: number;
}

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
}
