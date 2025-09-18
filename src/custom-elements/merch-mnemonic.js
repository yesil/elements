import { LitElement, html } from 'lit';
import { merchMnemonicStyleSheet } from './merch-mnemonic.css.js';

// Product map with icon URLs and optional target URLs
const PRODUCT_MAP = {
  'creative-cloud': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/creative-cloud.svg',
    target: 'https://www.adobe.com/creativecloud.html'
  },
  'acrobat-pro': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/acrobat-pro.svg',
    target: 'https://www.adobe.com/acrobat.html'
  },
  'photoshop': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/photoshop.svg',
    target: 'https://www.adobe.com/products/photoshop.html'
  },
  'premiere-pro': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/premiere-pro.svg',
    target: 'https://www.adobe.com/products/premiere.html'
  },
  'illustrator': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/illustrator.svg',
    target: 'https://www.adobe.com/products/illustrator.html'
  },
  'stock': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/stock.svg',
    target: 'https://stock.adobe.com/'
  },
  'express': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/express.svg',
    target: 'https://www.adobe.com/express/'
  },
  'firefly': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/firefly.svg',
    target: 'https://www.adobe.com/sensei/generative-ai/firefly.html'
  },
  'after-effects': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/after-effects.svg',
    target: 'https://www.adobe.com/products/aftereffects.html'
  },
  'lightroom': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/lightroom.svg',
    target: 'https://www.adobe.com/products/photoshop-lightroom.html'
  },
  'indesign': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/indesign.svg',
    target: 'https://www.adobe.com/products/indesign.html'
  },
  'animate': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/animate.svg',
    target: 'https://www.adobe.com/products/animate.html'
  },
  'dreamweaver': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/dreamweaver.svg',
    target: 'https://www.adobe.com/products/dreamweaver.html'
  },
  'substance-3d-stager': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/substance-3d-stager.svg',
    target: 'https://www.adobe.com/products/substance3d-stager.html'
  },
  'substance-3d-painter': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/substance-3d-painter.svg',
    target: 'https://www.adobe.com/products/substance3d-painter.html'
  },
  'substance-3d-sampler': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/substance-3d-sampler.svg',
    target: 'https://www.adobe.com/products/substance3d-sampler.html'
  },
  'substance-3d-designer': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/substance-3d-designer.svg',
    target: 'https://www.adobe.com/products/substance3d-designer.html'
  },
  'substance-3d-modeler': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/substance-3d-modeler.svg',
    target: 'https://www.adobe.com/products/substance3d-modeler.html'
  },
  'audition': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/audition.svg',
    target: 'https://www.adobe.com/products/audition.html'
  },
  'incopy': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/incopy.svg',
    target: 'https://www.adobe.com/products/incopy.html'
  },
  'aero': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/aero.svg',
    target: 'https://www.adobe.com/products/aero.html'
  },
  'photoshop-express': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/photoshop-express.svg',
    target: 'https://www.adobe.com/photoshop/online/photo-editor.html'
  },
  'digital-editions': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/digital-editions.svg',
    target: 'https://www.adobe.com/solutions/ebook/digital-editions.html'
  },
  'adobe-connect': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/adobe-connect.svg',
    target: 'https://www.adobe.com/products/adobeconnect.html'
  },
  'design-to-print': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/design-to-print.svg',
    target: null
  },
  'coldfusion': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/coldfusion.svg',
    target: 'https://www.adobe.com/products/coldfusion-family.html'
  },
  'presenter-video-express': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/presenter-video-express.svg',
    target: null
  },
  'framemaker-server': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/framemaker-server.svg',
    target: null
  },
  'http-dynamic-streaming': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/http-dynamic-streaming.svg',
    target: null
  },
  'captivate': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/captivate.svg',
    target: 'https://www.adobe.com/products/captivate.html'
  },
  'media-server': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/media-server.svg',
    target: null
  },
  'fonts': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/fonts.svg',
    target: 'https://fonts.adobe.com/'
  },
  'color': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/color.svg',
    target: 'https://color.adobe.com/'
  },
  'photoshop-elements': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/photoshop-elements.svg',
    target: 'https://www.adobe.com/products/photoshop-elements.html'
  },
  'premiere-elements': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/premiere-elements.svg',
    target: 'https://www.adobe.com/products/premiere-elements.html'
  },
  'technical-communication-suite': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/technical-communication-suite.svg',
    target: null
  },
  'postscript': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/postscript.svg',
    target: null
  },
  'behance': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/behance.svg',
    target: 'https://www.behance.net/'
  },
  'robohelp': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/robohelp.svg',
    target: 'https://www.adobe.com/products/robohelp.html'
  },
  'fresco': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/fresco.svg',
    target: 'https://www.adobe.com/products/fresco.html'
  },
  'lightroom-classic': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/lightroom-classic.svg',
    target: 'https://www.adobe.com/products/photoshop-lightroom-classic.html'
  },
  'experience-platform': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/experience-platform.svg',
    target: 'https://business.adobe.com/products/experience-platform/adobe-experience-platform.html'
  },
  'experience-cloud': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/experience-cloud.svg',
    target: 'https://business.adobe.com/products/experience-cloud/overview.html'
  },
  'coldfusion-builder': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/coldfusion-builder.svg',
    target: null
  },
  'pdf-print-engine': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/pdf-print-engine.svg',
    target: null
  },
  'capture': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/capture.svg',
    target: null
  },
  'bridge': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/bridge.svg',
    target: 'https://www.adobe.com/products/bridge.html'
  },
  'frame-io': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/frame-io.svg',
    target: 'https://frame.io/'
  },
  'character-animator': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/character-animator.svg',
    target: 'https://www.adobe.com/products/character-animator.html'
  },
  'media-encoder': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/media-encoder.svg',
    target: 'https://www.adobe.com/products/media-encoder.html'
  },
  'acrobat-scan': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/acrobat-scan.svg',
    target: null
  },
  'framemaker': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/framemaker.svg',
    target: 'https://www.adobe.com/products/framemaker.html'
  },
  'acrobat-sign': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/acrobat-sign.svg',
    target: 'https://www.adobe.com/sign.html'
  },
  'indesign-server': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/indesign-server.svg',
    target: null
  },
  'portfolio': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/portfolio.svg',
    target: null
  },
  'acrobat-classic': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/acrobat-classic.svg',
    target: null
  },
  'default-app-icon': {
    icon: 'https://www.adobe.com/cc-shared/assets/img/product-icons/svg/default-app-icon.svg',
    target: null
  }
};

export class MerchMnemonic extends LitElement {
  static get styles() {
    return [merchMnemonicStyleSheet];
  }

  static get properties() {
    return {
      name: { type: String, reflect: true },
      size: { type: String, reflect: true },
      href: { type: String, reflect: true },
      'icon-only': { type: Boolean, reflect: true, attribute: 'icon-only' }
    };
  }

  constructor() {
    super();
    this.name = '';
    this.size = 'l';
    this.href = '';
    this['icon-only'] = false;
  }

  get product() {
    return PRODUCT_MAP[this.name];
  }

  get iconUrl() {
    return this.product ? this.product.icon : PRODUCT_MAP['default-app-icon'].icon;
  }

  get hasLink() {
    return this.href || (this.product && this.product.target);
  }

  get targetUrl() {
    return this.href || (this.product && this.product.target);
  }

  handleClick(event) {
    if (this.targetUrl) {
      event.preventDefault();
      window.open(this.targetUrl, '_blank', 'noopener,noreferrer');
    }
  }

  render() {
    const img = html`
      <img 
        src="${this.iconUrl}" 
        alt="${this.name || 'Adobe product'}" 
        loading="lazy"
        @click=${this['icon-only'] ? this.handleClick : undefined}
      />
    `;

    if (this['icon-only'] || !this.hasLink) {
      return img;
    }

    return html`
      <a 
        href="${this.targetUrl}" 
        target="_blank" 
        rel="noopener noreferrer"
        @click=${this.handleClick}
      >
        ${img}
      </a>
    `;
  }
}

customElements.define('merch-mnemonic', MerchMnemonic);