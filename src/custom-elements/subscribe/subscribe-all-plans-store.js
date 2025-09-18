import { makeObservable } from 'picosm';

export class SubscribeAllPlansStore {
  static observableActions = [
    'setOpen',
    'setBillingTerm',
    'setRegion',
    'setOfferCodes',
    'setHrefBase',
    'setContinue',
  ];

  static computedProperties = ['isAnnual'];

  open = false;
  billingTerm = 'monthly';
  country = 'US';
  language = 'en';
  offerCodes = {}; // { [planId: string]: string }
  ctaHrefBase = '';
  selectedPlanId = '';
  continuePending = false;

  // Actions
  setOpen(v) {
    this.open = !!v;
  }

  setBillingTerm(term) {
    const v = term === 'annual' ? 'annual' : 'monthly';
    this.billingTerm = v;
  }

  setRegion(country, language) {
    if (country) this.country = String(country).toUpperCase();
    if (language) this.language = String(language).toLowerCase();
  }

  setOfferCodes(codes) {
    this.offerCodes = codes && typeof codes === 'object' ? { ...codes } : {};
  }

  setHrefBase(url) {
    this.ctaHrefBase = String(url || '');
  }

  setContinue(planId) {
    this.selectedPlanId = String(planId || '');
    this.continuePending = true;
  }

  // Computed
  get isAnnual() {
    return this.billingTerm === 'annual';
  }
}

makeObservable(SubscribeAllPlansStore);

export const subscribeAllPlansStore = new SubscribeAllPlansStore();

