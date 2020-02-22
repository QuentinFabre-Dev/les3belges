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
    public partial class GestionCommande : Form
    {
       // variables globales
        private Client leClient;
        private Produit leProduit; // produit courant
        private Commande laCommande;
        private int qte;
        private int maxNum; //dernier numéro de commande utilisé
        public GestionCommande()
        {
            InitializeComponent();
        }
        // Validation de la ligne de produit
        private void buttonValiderProduit_Click(object sender, EventArgs e)
        {
            // todo reference déjà dans le panier
            txtMessageP.Text = " ";
            // création de la ligne de commande
            LigneCommandeClient laLigne = new LigneCommandeClient(qte, laCommande, leProduit);
            // insertion dans la collection
            laCommande.getLesLignes().Add(laLigne);
           // ajout de la ligne dans le datagrid
            double totalLigne = Convert.ToDouble(textBoxPUHT.Text)*Int32.Parse(textBoxQuantite.Text);
            //Image imgPoubelle = Image.FromFile(@"C:\Users\Brigitte\Google Drive\Travail\2016-2017\PPE\L3B\L3BV1\sol_gestionPriseCommande - Les3Belges\gestionPriseCommande\Resources\Poubelle3.png");

            //Bitmap bmImgPoubelle = new Bitmap(imgPoubelle);
            string[] ligne = {textBoxReference.Text,textBoxNomProduit.Text,textBoxCouleur.Text,textBoxTaille.Text,textBoxPUHT.Text,textBoxQuantite.Text,textBoxEtat.Text,totalLigne.ToString()};
            dataGridViewListeProduit.Rows.Add(ligne);
            dataGridViewListeProduit.AutoSize = true;
            //maj total commande
            double totCde= laCommande.getMontantCommandeTTC()+totalLigne;
            laCommande.setMontantCommandeTTC(totCde);
            textBoxTotCde.Text = totCde.ToString();
            textBoxTva.Text = (Math.Round(totCde * leProduit.getTauxTVA()/100,2)).ToString();
            razPanel(panel1);
            txtMessageP.Text = "Entrez une référence et appuyez sur entrée ou validez le panier";
        }
        //  Click bouton RAZ produit
        private void buttonRAZ_Click(object sender, EventArgs e)
        {
            razPanel(panel1);
            txtMessageP.Text = "Entrez une référence et appuyez sur entrée ou validez le panier";
        }
        // Validation de la commande
        private void buttonValiderCommande_Click(object sender, EventArgs e)
        {   

            int insertOk = 0;
            DialogResult reponse = MessageBox.Show(this, "Êtes-vous sûr de vouloir enregistrer cette commande ?", "Enregistrer comande", MessageBoxButtons.OKCancel);
            if (reponse == DialogResult.OK)
            {   //création de la commande dans la BDD
                int cdeOk = Passerelle.creerCommande(laCommande);
                if ( cdeOk == 0)
                {    MessageBox.Show(" Souci sur l'insertion de la commande"); }
                else
                { //insertion des lignes dans lignes de commande et mise à jour stock
                    foreach (LigneCommandeClient ligne in laCommande.getLesLignes())
                    {
                        insertOk=Passerelle.creerLigneCommande(ligne);
                        if (insertOk != 0)
                        {    
                            // mise à jour Produit objet et bdd
                            ligne.getLeProduit().diminuerStockTemp(ligne.getLaQuantité());
                            Passerelle.majStockTempProd(ligne.getLeProduit());
                            //todo vérifier code retour
                        }
                        else
                        { MessageBox.Show("il y a un souci sur l'insertion du produit" + ligne.getLeProduit().getReference()); }
                    }
                
                         MessageBox.Show("La commande a été enregistrée avec succès !");
                        //suppression des objets
                        leClient = null;
                        laCommande = null;
                        leProduit = null;                      
                        razPanel(panel3);
                        razPanel(panel2);
                        panel2.Visible = true;
                        panel1.Visible = false;
                        panel3.Visible = false;
                 }
            }
        }
        //  Click bouton Quitter formulaire
        private void buttonQuitter_Click(object sender, EventArgs e)
        {
            this.Close();
        }
        private void GestionCommande_Load(object sender, EventArgs e)
        {   panel2.Visible = true;
            panel1.Visible = false;
            panel3.Visible = false;
            TxtMessage.ForeColor = System.Drawing.Color.Green;
            txtMessageP.ForeColor = System.Drawing.Color.Green;
            TxtMessage.Text = "Entrez un numéro et appuyez sur entrée";
            TxtMessage.Visible = true;
           
            if (Passerelle.connectBase()==false)
            { MessageBox.Show("Souci connexion BDD"); 
            }
            else 
            { maxNum = Passerelle.getMaxNumCde(); }
        }
        // validation du numéro de client
        private void textBoxNumCli_KeyDown(object sender, KeyEventArgs e)
        
        
       { if(e.KeyCode == Keys.Enter)
            {  // remplissage des informations clients
                if (Passerelle.convertNum(textBoxNumCli.Text)==true)
                {
                    leClient = Passerelle.getLeClientByNum(Convert.ToInt32(textBoxNumCli.Text));
                    if (leClient != null)
                    {
                        textBoxNom.Text = leClient.getNomClient();
                        textBoxPrenom.Text = leClient.getPrenomClient();
                        textBoxCodePostal.Text = leClient.getCpClient();
                        textBoxTelephone.Text = leClient.getTelClient().ToString();
                        // affichage des éléments
                        TxtMessage.Visible = false;
                        panel1.Visible = true;
                        panel3.Visible = true;
                        textBoxReference.Focus();
                        txtMessageP.Text = "Entrez une référence et appuyez sur entrée  ";
                        // instanciation de la commande
                        laCommande = new Commande(leClient);
                        maxNum = maxNum + 1;
                        laCommande.setNumCde(maxNum);
                        laCommande.setMontantCommandeTTC(0);
                    }
                    else
                    {
                        MessageBox.Show("Erreur numéro de client inexistant dans la  BDD");
                        textBoxNumCli.Text = "";
                    }
                }
                else
                {
                    MessageBox.Show("Erreur le numéro de client doit être numérique");
                    textBoxNumCli.Text = "";
                }
            }
        }
        // validation du numéro de produit
        private void textBoxReference_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {   // vérif saisie produit
                if (textBoxReference.Text !="")
                { // remplissage des informations produit
                    textBoxReference.Text = boiteOutil.enMajuscule(textBoxReference.Text.ToString());
                    leProduit = Passerelle.getProduit(textBoxReference.Text.Trim());
                    if (leProduit != null)
                    {
                        textBoxNomProduit.Text = leProduit.getLibelleProduit();
                        textBoxPUHT.Text = leProduit.getPrixUHTProduit().ToString();
                        textBoxCouleur.Text = leProduit.getCouleurProduit();
                        textBoxTaille.Text = leProduit.getTailleProduit();
                        textBoxQuantite.Focus();
                        txtMessageP.Text = "Entrez une quantité et appuyez sur entrée";
                    }
                    else
                    {
                        MessageBox.Show("Erreur référence produit inexistante");
                        textBoxReference.Clear();
                    }
                }
                else
                {
                    MessageBox.Show("Il faut remplir le numéro de produit");
                    textBoxReference.Clear();
                }
            }
        }
        // validation de la quantité
        private void textBoxQuantite_KeyDown(object sender, KeyEventArgs e)
        {   if (e.KeyCode == Keys.Enter)
                {  // vérifie que la quantité est remplie et entière
                    if (Passerelle.convertNum(textBoxQuantite.Text)==true )
                    {
                        qte = Int32.Parse(textBoxQuantite.Text);
                        if (qte !=0)
                        { //test quantité suffisante
                            if (qte <= leProduit.getStockTemp())
                            { textBoxEtat.Text = "disponible"; }
                            else
                            { textBoxEtat.Text = "sous " + leProduit.getDelaiReapro() + " semaines"; }
                            txtMessageP.Text = "                   Cliquez sur Valider ou RAZ";
                            buttonValiderProduit.Focus();
                        }
                    }
                    else 
                    { MessageBox.Show("la quantité est incorrecte"); }
                }
        }
        private void pictureBoxPoubelle_Click(object sender, EventArgs e)
        {
            // suppression de ligne
        }
        // Remise à blanc des zones de texte d'un panel passé en paramètre
        private void razPanel(Panel unPanel)
        {
            foreach(Control unControl in  unPanel.Controls)
            {
                if (unControl.GetType()== textBoxReference.GetType())
                {unControl.Text="";}
            }
       }

       
    }
}
