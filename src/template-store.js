import { makeObservable } from 'picosm';

export class TemplateStore {
  static observableActions = ['loadTemplates', 'addTemplate', 'removeTemplate', 'clearTemplates', 'fetchTemplateContent'];

  templates = [
    ['Compare 2 merch cards', './templates/compare-cards-2.html'],
    ['Compare 3 merch cards', './templates/compare-cards-3.html'],
    ['Single merch card', './templates/single-card.html'],
    ['CC Pro - subscribe modal', './templates/subscribe-all-plans-3.html'],
  ];
  templateCache = new Map(); // Cache fetched content
  
  async init() {
    // Initialize template store - currently no async initialization needed
    return true;
  }
  
  loadTemplates(templateSources) {
    this.templates = [];
    
    for (const [title, url] of templateSources) {
      this.addTemplate({
        title,
        url,
        id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      });
    }
    
    return this.templates;
  }
  
  addTemplate(template) {
    if (!template.title || !template.url) {
      console.warn('Template must have both title and url');
      return;
    }
    this.templates.push(template);
  }
  
  removeTemplate(templateId) {
    const index = this.templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      this.templates.splice(index, 1);
      this.templateCache.delete(templateId);
    }
  }
  
  clearTemplates() {
    this.templates = [];
    this.templateCache.clear();
  }
  
  async fetchTemplateContent(url) {
    // Check cache first
    if (this.templateCache.has(url)) {
      return this.templateCache.get(url);
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      
      // Cache the content
      this.templateCache.set(url, content);
      
      return content;
    } catch (error) {
      console.error(`Failed to fetch template "${url}":`, error);
      return null;
    }
  }
}

makeObservable(TemplateStore);
