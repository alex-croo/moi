import type { Recipe, RecipeIngredient } from './types';
export type RecipePreparation = {id:string;blendId?:string;title:string;titleEn:string;ingredients:Pick<RecipeIngredient,'ingredientId'|'quantity'|'grams'>[]};
export const recipePreparations=(recipe:Recipe)=>(recipe as Recipe & {preparations?:RecipePreparation[]}).preparations||[];
