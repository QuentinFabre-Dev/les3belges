using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using les3belges;
using ClassLibraryL3B;

namespace gestionPriseCommande
{
    public partial class EnregistrementLivraison : Form
    {
        //TODO : Gerer la sélection de l'expediteur
        // ---> suppression de la table TARIFS et ajout de la clef primaire poids dans facture

        List<Commande> cmdAttentes;
        public EnregistrementLivraison()
        {
            InitializeComponent();
        }

        private void EnregistrementLivraison_Load(object sender, EventArgs e)
        {
            //Ajoute les numéros de commandes au ComboBox
           cmdAttentes = Passerelle.getCommandeAttentes();

            foreach (Commande cmd in cmdAttentes)
            {
                comboNumCmd.Items.Add(cmd.getNumCommande());
            }
        }

        private void comboNumCmd_SelectedIndexChanged(object sender, EventArgs e)
        {
            dataGridCmd.Rows.Clear();
            int i = comboNumCmd.SelectedIndex;
            Commande laCommande = cmdAttentes[i];
            Client leClient = laCommande.getLeClient();

            //Association des label avec le client de la commande
            labelNum.Text = leClient.getNumClient().ToString();
            labelNom.Text = leClient.getNomClient().ToString();
            labelEmail.Text = leClient.getEmailClient().ToString();
            labelPrenom.Text = leClient.getPrenomClient().ToString();
            labelTel.Text = leClient.getTelClient().ToString();
            labelAdresse.Text = leClient.getAdresseClient().ToString();

            //Remplir le Datagrid
            List<LigneCommandeClient> lesLignes = Passerelle.getLignesCmd(laCommande);

            foreach(LigneCommandeClient ligne in lesLignes)
            {
                Produit prod = ligne.getLeProduit();
                dataGridCmd.Rows.Add(ligne.getLeProduit().getReference(), ligne.getLaQuantité(), prod.getPrixUHTProduit(), prod.getPrixUHTProduit() * ligne.getLaQuantité(), prod.getPoids());
            }
            
            //Choix de l'expediteur
            double poidsCommande = laCommande.getPoids();
            labelPoids.Text = poidsCommande.ToString()+" Kg";

            Facturer laFacture = Passerelle.getBestExpediteur(poidsCommande);
            labelTransp.Text = laFacture.getExpediteur().getLibelleExp();
            labelPrix.Text = laFacture.getPrix().ToString()+" €";

        }
    }
}
