# Barber Junior — Réservation en ligne

Site de réservation (une seule page) pour Barber Junior, Tabriquet, Salé.

- `index.html` : le site. Toute la configuration (services, prix, coiffeurs, horaires, WhatsApp) est dans l'objet `CONFIG` en haut du fichier.
- `backend/Code.gs` : backend Google Apps Script relié à la Google Sheet « Réservations Barber Junior ».

Pour annuler une réservation : écrire `annulé` dans la colonne `statut` de la Sheet.
