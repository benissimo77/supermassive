case "hotspot":
    case "point-it-out":
        const imageSelector = document.getElementById('answer-image');
        imageSelector.setAttribute('src', question.image);
        imageSelector.onload = () => {
            console.log('imageSelector.onload:', imageSelector);
            const overlay = new Overlay(imageSelector);
            overlay.onCrossAdded( () => {
                this.socket.emit('consolelog', e.detail);
                document.getElementById('submit-button').classList.add('active');
            });
            document.getElementById('submit-button').addEventListener('click', (e) => {
                const coords = overlay.getNormalizedCoordinates(0);
                this.socket.emit('client:response', coords );
                e.currentTarget.classList.remove('active');
            });	
        }
        break;

