// .js
export class AudioPlayer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._src = null;
        this.srcID = null;
        this._startSeconds = 0;
        this._duration = 0;
        this._overlay = null;
        this._player = null;
        this._height = 0;
        this._width = 0;
        this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));
    }

    static get observedAttributes() {
        return ['src', 'duration'];
    }

    connectedCallback() {
        console.log('ConnectedCallback...');
        this._resizeObserver.observe(this);
        // Set a default size if not specified by the parent
        if (!this.style.width) this.style.width = '200px';
        if (!this.style.height) this.style.height = '120px'; // You can adjust this default
        this.createPlayer();
    }

    createPlayer() {

        // Remove an old player if already exists (eg player stopped and needs to be re-initialized)
        if (this.shadowRoot.getElementById('player')) {
            this.shadowRoot.getElementById('player').remove();
        }
        this.render();

        console.log('AudioPlayer:: createPlayer:', this._srcID, this._player);

        let playerVars = {
            'fs': 0,
            'playsinline': 1,
            'start': this._startSeconds,
        }
        if (this._duration > 0) {
            playerVars.end = this._startSeconds + this._duration;
            console.log('end time:', playerVars.end);
        }
        this._player = new YT.Player(this.shadowRoot.getElementById("player"), {
            height: '100%',
            width: '100%',
            videoId: this._srcID,
            playerVars: playerVars,
            events: {
              'onStateChange': this.onPlayerStateChange.bind(this)
            }
        });  
      
    }

    disconnectedCallback() {
        this._resizeObserver.unobserve(this);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'src':
                this.setSrc(newValue);
                break;
            case 'duration':
                this._duration = parseInt(newValue);
                break;
        }
    }

    render() {
        const style = `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            #container {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            #overlay {
                width:100%;
                height:100%;
                position:absolute;
                top:0;
                left:0;
                background-color: rgba(0,0,0, 0.6);
            }

        `;

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div id="container">
                <div id="overlay"></div>
                <div id="player"></div>
            </div>
        `;

        this._player = this.shadowRoot.getElementById('player');
        this._overlay = this.shadowRoot.getElementById('overlay');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this._overlay.addEventListener('click', this.handleClick.bind(this));
    }

    handleClick() {
        console.log('CLICK');
        if (this._player.getPlayerState() == YT.PlayerState.PLAYING) {
            this._player.pauseVideo();
        } else {
            this._player.playVideo();
        }


    }
    _handleResize() {
        console.log('AudioPlayer;: handleResize:', this.style.width, this.style.height);
        this._height = this.style.height;
        this._width = this.style.width;
        this.createPlayer();
    }

    isStringAnInteger(str) {
        const parsed = parseInt(str, 10);
        return !isNaN(parsed) && parsed.toString() === str.trim();
      }
      
    getSrcID(src) {
        const srcParts = src.split("?");
        const stub = srcParts[0];
        const srcID = stub.split("/").pop();
        return srcID;
    }
    getURLParam(src, param = 't') {
        const srcParts = src.split("?");
        let URLString = '';
        let URLParams = [];
        let URLParamsObj = [];
        if (srcParts.length > 1) {
            URLString = srcParts[1];
            URLParams = URLString.split("&");
            if (URLParams.length > 0) {
                URLParamsObj = URLParams.map( (param) => { console.log('Param:', param); return { key:param.split("=")[0], value:param.split("=")[1] || '' }});
            }
        }
        let t = '';
        if (URLParamsObj.length > 0) {
            URLParamsObj.forEach( (item) => { console.log('Item:', item, item.key); if (item.key === param) t = item.value } );
        }
        console.log('Phew... URL parsed:', URLParams, URLParamsObj, t);
        return t
    }
    setSrc(src) {
        console.log('setSrc:', src);
        this._src = src;
        if (this.getURLParam(src, 'v')) {
            this._srcID = this.getURLParam(src, 'v');
        } else {
            this._srcID = this.getSrcID(src);
        }
        const startTime = this.getURLParam(src, 't');
        this._startSeconds = 0;
        if (this.isStringAnInteger(startTime)) {
            this._startSeconds = parseInt(startTime);
        }
    }

    onPlayerStateChange(event) {
        console.log('AudioPlayer: onPlayerStateChange:', event.data);
        if (event.data == YT.PlayerState.ENDED) console.log('YT.PlayerState.ENDED');
        if (event.data == YT.PlayerState.PLAYING) console.log('YT.PlayerState.PLAYING');
        if (event.data == YT.PlayerState.PAUSED) console.log('YT.PlayerState.PAUSED');
        if (event.data == YT.PlayerState.BUFFERING) console.log('YT.PlayerState.BUFFERING');
        if (event.data == YT.PlayerState.CUED) console.log('YT.PlayerState.CUED');
      
        if (event.data == YT.PlayerState.PAUSED) {
            this.createPlayer();
          }
          if (event.data == YT.PlayerState.ENDED) {
            this.createPlayer();
          }
          }
      
}

customElements.define('audio-player', AudioPlayer);
