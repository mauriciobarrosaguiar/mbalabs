package br.com.mbalabs.calda;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.Locale;

/** MBA Calda: native Android views, offline and without WebView or network permissions. */
public class MainActivity extends Activity {
    private static final int BG = 0xFFF7FBF5;
    private static final int DARK = 0xFF05391E;
    private static final int TEXT = 0xFF162B1C;
    private static final int LIGHT_GREEN = 0xFFEAF7DE;
    private static final int PANEL = 0xFFFFFFFF;
    private static final int INPUT = 0xFFFFFFFF;
    private static final int LIME = 0xFF78CF29;
    private static final int CYAN = 0xFF18A758;
    private static final int WHITE = 0xFFF4F8F1;
    private static final int MUTED = 0xFF526B58;
    private static final int BORDER = 0xFFC9DFC3;
    private static final String[] UNITS = {"mL/ha", "L/ha", "g/ha", "kg/ha"};
    private final DecimalFormat fmt = new DecimalFormat("#,##0.###", new DecimalFormatSymbols(new Locale("pt", "BR")));
    private final ArrayList<Product> products = new ArrayList<>();
    private SharedPreferences store;
    private LinearLayout list;
    private EditText mixer, tank, rate;
    private Spinner droneModel;
    private TextView tanksText, tanksDetail, resultSummary;
    private LinearLayout resultsCard, productResults;
    private String lastSummary = null;
    private boolean resultsVisible = false;
    private static final String[] DRONES = {"Outro modelo / personalizado", "DJI Agras T25P — 20 L", "DJI Agras T50 — 40 L", "DJI Agras T55 — 50 L", "DJI Agras T70P — 70 L", "DJI Agras T100 — 100 L"};
    private static final int[] DRONE_CAPS = {0,20,40,50,70,100};
    private TextView areaText, areaDetail, countText;
    private boolean restoring;

    private static class Product {
        LinearLayout card;
        TextView heading, resultLabel;
        EditText name, dose;
        Spinner unit;
    }

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(0xFFF5FAF2);
        getWindow().setNavigationBarColor(0xFFF5FAF2);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        store = getSharedPreferences("mba_calda", MODE_PRIVATE);
        buildScreen();
        restore();
        calculate();
    }

    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + .5f); }
    private LinearLayout vertical() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.VERTICAL); return x; }
    private LinearLayout horizontal() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.HORIZONTAL); return x; }
    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w < 0 ? w : dp(w), h < 0 ? h : dp(h)); }
    private LinearLayout.LayoutParams top(int gap) { LinearLayout.LayoutParams p = lp(-1,-2); p.topMargin = dp(gap); return p; }
    private GradientDrawable shape(int color, int border, float radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color); d.setCornerRadius(dp(radius));
        if(border != Color.TRANSPARENT) d.setStroke(dp(1), border);
        return d;
    }
    private GradientDrawable gradient(int a, int b, int border, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{a,b});
        d.setCornerRadius(dp(radius));
        if (border != Color.TRANSPARENT) d.setStroke(dp(1),border);
        return d;
    }
    private TextView text(String s, float sp, int color, boolean bold, boolean mono) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setIncludeFontPadding(true);
        t.setTypeface(Typeface.create(mono?"monospace":"sans-serif-condensed", bold?Typeface.BOLD:Typeface.NORMAL));
        if (mono) t.setLetterSpacing(.15f);
        return t;
    }
    private TextView caps(String s, int sp, int color) {
        TextView t = text(s,sp,color,false,true); t.setLetterSpacing(.23f); return t;
    }
    private void section(LinearLayout page, String index, String title) {
        LinearLayout bar=horizontal(); bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView number=text(index,21,Color.WHITE,true,false);
        number.setGravity(Gravity.CENTER);
        number.setBackground(gradient(0xFF52BA15,0xFF0E852C,Color.TRANSPARENT,50));
        bar.addView(number,lp(52,52));
        TextView heading=text(title,18,DARK,true,false);
        heading.setLetterSpacing(.015f);heading.setLineSpacing(0,1.03f);
        LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(0,-2,1);
        hp.leftMargin=dp(13);bar.addView(heading,hp);
        page.addView(bar,top(24));
    }
    
    private EditText edit(String hint, boolean numeric) {
        EditText e=new EditText(this);
        e.setSingleLine(true);e.setTextColor(TEXT);e.setHintTextColor(0xFF83958B);
        e.setTextSize(17);e.setHint(hint);
        e.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
        e.setPadding(dp(13),0,dp(12),0);
        e.setBackground(shape(INPUT,BORDER,12));
        if(numeric)e.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        else e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        return e;
    }
    
    private EditText inputWithSuffix(LinearLayout parent,String hint,String suffix) {
        LinearLayout row=horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        EditText field=new EditText(this);
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        field.setBackgroundColor(Color.TRANSPARENT);
        field.setTextSize(27);field.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));
        field.setTextColor(TEXT);field.setHintTextColor(0xFF8F9E95);field.setHint(hint);
        field.setPadding(0,0,0,0);
        row.addView(field,new LinearLayout.LayoutParams(0,dp(53),1));
        TextView unit=text(suffix,15,DARK,true,false);row.addView(unit);
        parent.addView(row,top(3));watch(field);
        return field;
    }
    
    private LinearLayout metric(String title,String hint,String unit) {
        LinearLayout card=vertical();
        card.setBackground(shape(PANEL,BORDER,16));
        card.setPadding(dp(12),dp(12),dp(11),dp(10));
        TextView tag=text(title,12,DARK,true,false);
        tag.setMaxLines(2);card.addView(tag);return card;
    }
    private void explanation(LinearLayout page,String content) {
        LinearLayout card=vertical();card.setPadding(dp(14),dp(13),dp(14),dp(13));
        card.setBackground(shape(0xFFEAF6E2,0xFFD4E9CB,13));
        TextView t=text(content,14,DARK,false,false);
        t.setLineSpacing(dp(3),1f);card.addView(t);
        page.addView(card,top(12));
    }
    private void prepLine(LinearLayout parent,String number,String title,String detail){
        LinearLayout line=horizontal();line.setGravity(Gravity.TOP);
        TextView mark=text(number,16,Color.WHITE,true,false);
        mark.setGravity(Gravity.CENTER);mark.setBackground(shape(0xFF168436,Color.TRANSPARENT,50));
        line.addView(mark,lp(33,33));
        LinearLayout content=vertical();
        TextView a=text(title,15,DARK,true,false);
        TextView b=text(detail,13,MUTED,false,false);b.setLineSpacing(dp(2),1f);
        content.addView(a);content.addView(b,top(3));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,-2,1);cp.leftMargin=dp(12);line.addView(content,cp);
        parent.addView(line,top(13));
    }
    
    private void buildScreen() {
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);
        scroll.setClipToPadding(false);scroll.setVerticalScrollBarEnabled(false);
        scroll.setBackground(new GridDrawable());
        LinearLayout page=vertical();page.setPadding(dp(16),dp(17),dp(16),dp(38));
        scroll.addView(page,new ScrollView.LayoutParams(-1,-2));

        LinearLayout hero=vertical();hero.setPadding(dp(19),dp(19),dp(19),dp(20));
        hero.setBackground(gradient(0xFF003B1D,0xFF006027,Color.TRANSPARENT,20));
        hero.addView(text("MBA CALDA  •  DRONES AGRÍCOLAS",12,0xFFB5EA7D,true,false));
        hero.addView(text("CÁLCULO DE CALDA",28,Color.WHITE,true,false),top(9));
        hero.addView(text("DO MISTURADOR AO TANQUE DO DRONE",13,0xFFDEEDD9,true,false),top(4));
        page.addView(hero);
        LinearLayout objective=vertical();objective.setPadding(dp(15),dp(12),dp(15),dp(12));
        objective.setBackground(shape(LIGHT_GREEN,0xFFC7E8BA,14));
        objective.addView(text("OBJETIVO",11,0xFF17692F,true,false));
        objective.addView(text("Calcular hectares, abastecimentos e a quantidade de cada produto para preparar a calda no misturador.",14,TEXT,false,false),top(4));
        page.addView(objective,top(12));

        section(page,"1","QUANTOS HECTARES O MISTURADOR FAZ?");
        LinearLayout fields=horizontal();
        LinearLayout mixCard=metric("MISTURADOR","200","L");
        LinearLayout rateCard=metric("TAXA DE APLICAÇÃO","10","L/ha");
        mixer=inputWithSuffix(mixCard,"200","L");
        rate=inputWithSuffix(rateCard,"10","L/ha");
        fields.addView(mixCard,new LinearLayout.LayoutParams(0,dp(108),1));
        LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,dp(108),1);
        right.leftMargin=dp(9);fields.addView(rateCard,right);
        page.addView(fields,top(12));
        explanation(page,"HECTARES = volume FINAL do misturador (L) ÷ taxa de aplicação (L/ha).\nA taxa em L/ha não é a vazão da bomba em L/min.");

        LinearLayout area=vertical();area.setPadding(dp(16),dp(13),dp(16),dp(15));
        area.setBackground(shape(0xFFDDF4CF,0xFFB8DBA9,16));
        area.addView(text("ÁREA ATENDIDA PELO MISTURADOR",12,0xFF17652D,true,false));
        LinearLayout areaRow=horizontal();areaRow.setGravity(Gravity.CENTER_VERTICAL);
        areaText=text("— ha",35,0xFF06672C,true,false);
        areaRow.addView(areaText,new LinearLayout.LayoutParams(0,dp(59),1));
        areaRow.addView(new CropIcon(this),lp(62,54));area.addView(areaRow,top(2));
        areaDetail=text("Informe a capacidade e a taxa.",13,DARK,false,false);area.addView(areaDetail);
        page.addView(area,top(12));

        section(page,"2","QUANTOS TANQUES DE DRONE ELE ABASTECE?");
        LinearLayout droneCard=vertical();droneCard.setPadding(dp(13),dp(13),dp(13),dp(14));
        droneCard.setBackground(shape(Color.WHITE,BORDER,16));
        droneCard.addView(text("MODELO DO DRONE (PULVERIZAÇÃO)",12,DARK,true,false));
        droneModel=new Spinner(this);
        ArrayAdapter<String> droneAdapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,DRONES){
            @Override public View getView(int pos,View convert,ViewGroup parent) {return unitText(getItem(pos),false);}
            @Override public View getDropDownView(int pos,View convert,ViewGroup parent) {return unitText(getItem(pos),true);}
        };
        droneModel.setAdapter(droneAdapter);droneModel.setBackground(shape(0xFFF2FBEF,BORDER,12));
        droneCard.addView(droneModel,top(8));droneModel.getLayoutParams().height=dp(55);
        LinearLayout capacity=metric("CAPACIDADE DO TANQUE DO DRONE","40","L");
        tank=inputWithSuffix(capacity,"40","L");
        droneCard.addView(capacity,top(10));
        page.addView(droneCard,top(12));
        droneModel.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(AdapterView<?> a,View v,int pos,long id) {
                if(!restoring && pos>0)tank.setText(String.valueOf(DRONE_CAPS[pos]));
                calculate();
            }
            @Override public void onNothingSelected(AdapterView<?> a){}
        });
        explanation(page,"TANQUES = volume do misturador ÷ volume do tanque do drone.\nMostramos os tanques cheios e a sobra para um último abastecimento parcial.");
        LinearLayout fills=vertical();fills.setPadding(dp(16),dp(14),dp(16),dp(15));
        fills.setBackground(shape(0xFFF1F9EC,BORDER,16));
        fills.addView(text("ABASTECIMENTOS DISPONÍVEIS",12,DARK,true,false));
        tanksText=text("—",25,0xFF086C2C,true,false);fills.addView(tanksText,top(5));
        tanksDetail=text("Informe a capacidade do drone.",14,MUTED,false,false);
        tanksDetail.setLineSpacing(dp(3),1f);fills.addView(tanksDetail,top(3));
        page.addView(fills,top(12));

        section(page,"3","CADASTRE OS PRODUTOS E AS DOSES");
        explanation(page,"Digite o nome, a dose por hectare e a unidade de cada produto. O cálculo será feito para o misturador inteiro.");
        list=vertical();page.addView(list,top(12));
        TextView add=text("+ ADICIONAR PRODUTO",15,DARK,true,false);
        add.setGravity(Gravity.CENTER);add.setBackground(shape(0xFFF2FBEA,0xFF7CB85C,13));
        add.setOnClickListener(v->{addProduct("","",0);calculate();});
        page.addView(add,top(11));add.getLayoutParams().height=dp(52);
        countText=text("ADICIONE OS PRODUTOS",12,MUTED,true,false);
        countText.setGravity(Gravity.CENTER);page.addView(countText,top(12));

        TextView go=text("CALCULAR MINHA CALDA",18,Color.WHITE,true,false);
        go.setGravity(Gravity.CENTER);
        go.setBackground(gradient(0xFF08752D,0xFF48BB20,Color.TRANSPARENT,15));
        go.setOnClickListener(v->calculateFinal());
        page.addView(go,top(17));go.getLayoutParams().height=dp(62);

        resultsCard=vertical();resultsCard.setPadding(dp(16),dp(15),dp(16),dp(17));
        resultsCard.setBackground(shape(0xFFEBF8E4,0xFFACD99B,16));
        resultsCard.addView(text("4  RESULTADO DA CALDA",20,DARK,true,false));
        resultSummary=text("",15,DARK,false,false);resultSummary.setLineSpacing(dp(4),1f);
        resultsCard.addView(resultSummary,top(13));
        productResults=vertical();resultsCard.addView(productResults,top(9));
        TextView copy=text("COPIAR RESUMO COMPLETO",15,Color.WHITE,true,false);
        copy.setGravity(Gravity.CENTER);
        copy.setBackground(gradient(0xFF11782E,0xFF4AAE20,Color.TRANSPARENT,13));
        copy.setOnClickListener(v->copySummary());
        resultsCard.addView(copy,top(14));copy.getLayoutParams().height=dp(54);
        page.addView(resultsCard,top(15));
        resultsCard.setVisibility(View.GONE);

        section(page,"5","PREPARE A CALDA NO MISTURADOR");
        LinearLayout prep=vertical();prep.setPadding(dp(16),dp(6),dp(16),dp(18));
        prep.setBackground(shape(Color.WHITE,BORDER,17));
        prepLine(prep,"1","Confira a prescrição e a bula","Verifique dose, compatibilidade e sequência recomendada.");
        prepLine(prep,"2","Meça os produtos calculados","Use o resultado POR MISTURADOR, não multiplique a dose novamente pelos tanques.");
        prepLine(prep,"3","Complete até o volume FINAL","O volume do misturador inclui produtos e água; não acrescente tudo em água.");
        prepLine(prep,"4","Agite e abasteça o drone","Siga as condições de mistura e faça os abastecimentos previstos.");
        page.addView(prep,top(12));
        LinearLayout rule=vertical();rule.setPadding(dp(15),dp(14),dp(15),dp(14));
        rule.setBackground(gradient(0xFF00602B,0xFF078D39,Color.TRANSPARENT,15));
        rule.addView(text("REGRA FÁCIL",14,0xFFDCFFC6,true,false));
        rule.addView(text("Misturador ÷ L/ha = hectares",16,Color.WHITE,true,false),top(5));
        rule.addView(text("Misturador ÷ tanque = abastecimentos",15,Color.WHITE,true,false),top(2));
        rule.addView(text("Hectares × dose/ha = produto no misturador",15,Color.WHITE,true,false),top(2));
        page.addView(rule,top(15));

        TextView clear=text("LIMPAR TODOS OS CAMPOS",13,MUTED,true,false);
        clear.setGravity(Gravity.CENTER);clear.setOnClickListener(v->confirmClear());
        page.addView(clear,top(11));clear.getLayoutParams().height=dp(42);
        LinearLayout alert=vertical();alert.setPadding(dp(13),dp(12),dp(13),dp(13));
        alert.setBackground(shape(0xFFFFF9E7,0xFFF2D99C,13));
        TextView note=text("⚠ IMPORTANTE: ferramenta de cálculo, não de prescrição. Siga bula, receita agronômica, compatibilidade e EPI. Considere o volume FINAL da calda no misturador e no drone.",13,0xFF624B15,false,false);
        note.setLineSpacing(dp(3),1f);alert.addView(note);
        page.addView(alert,top(15));
        setContentView(scroll);
    }
    
    private void addProduct(String name,String dose,int selected) {
        Product p=new Product();
        LinearLayout card=vertical(); card.setPadding(dp(16),dp(15),dp(16),dp(16));
        card.setBackground(shape(0xFFFFFFFF,BORDER,16)); p.card=card;
        LinearLayout top=horizontal(); top.setGravity(Gravity.CENTER_VERTICAL);
        p.heading=text("PRODUTO 01",15,DARK,true,false);
        top.addView(p.heading,new LinearLayout.LayoutParams(0,dp(40),1));
        TrashIcon trash = new TrashIcon(this);
        trash.setContentDescription("Remover produto");
        trash.setOnClickListener(v->{
            products.remove(p); list.removeView(p.card);
            if(products.isEmpty()) addProduct("","",0);
            reindex(); calculate();
        });
        top.addView(trash,lp(43,41)); card.addView(top);

        p.name=edit("Nome do produto",false); p.name.setText(name);
        card.addView(p.name,top(5)); p.name.getLayoutParams().height=dp(54);

        LinearLayout row=horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        p.dose=edit("Dose ex.: 250",true); p.dose.setText(dose);
        row.addView(p.dose,new LinearLayout.LayoutParams(0,dp(54),1));

        p.unit=new Spinner(this);
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,UNITS){
            @Override public View getView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),false); }
            @Override public View getDropDownView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),true); }
        };
        p.unit.setAdapter(adapter);
        p.unit.setBackground(shape(INPUT,BORDER,11));
        p.unit.setSelection(Math.min(UNITS.length-1,Math.max(0,selected)));
        LinearLayout.LayoutParams up = lp(101,54); up.leftMargin=dp(8);
        row.addView(p.unit,up); card.addView(row,top(11));

        LinearLayout output=horizontal();output.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable line=shape(0xFFEAF7E4,0xFFCBE8C0,12);
        output.setBackground(line);
        output.setPadding(dp(13),dp(11),dp(12),dp(11));
        TextView label=text("NO MISTURADOR",12,DARK,true,false);
        output.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        p.resultLabel=text("toque em calcular",13,MUTED,true,false);
        p.resultLabel.setGravity(Gravity.END); p.resultLabel.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_END);
        output.addView(p.resultLabel,new LinearLayout.LayoutParams(0,-2,1.32f));
        card.addView(output,top(11));

        products.add(p);list.addView(card,top(products.size()==1?0:12));
        reindex();watch(p.name);watch(p.dose);
        p.unit.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(AdapterView<?> a,View v,int pos,long id){calculate();}
            @Override public void onNothingSelected(AdapterView<?> a){}
        });
    }
    private TextView unitText(String title,boolean drop) {
        TextView t=text(title,15,TEXT,false,false);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(13),dp(8),dp(4),dp(8));
        t.setMinHeight(dp(drop?48:50));
        if(drop) t.setBackgroundColor(0xFFE9F5E5);
        return t;
    }
    private void reindex(){for(int i=0;i<products.size();i++)products.get(i).heading.setText(String.format(Locale.US,"PRODUTO %02d",i+1));}
    private void watch(EditText e){e.addTextChangedListener(new TextWatcher(){
        @Override public void beforeTextChanged(CharSequence s,int start,int count,int after){}
        @Override public void onTextChanged(CharSequence s,int start,int before,int count){calculate();}
        @Override public void afterTextChanged(Editable e){}
    });}
    private Double positive(String text){
        try {
            String s=text.trim().replace(" ","");
            if(s.contains(",")) s=s.replace(".","").replace(',','.');
            double x=Double.parseDouble(s);
            return Double.isFinite(x)&&x>0 ? x : null;
        }catch(Exception e){return null;}
    }
    private Double hectares(){
        if(tank==null||rate==null)return null;
        Double t=positive(tank.getText().toString()); Double r=positive(rate.getText().toString());
        return t==null||r==null?null:t/r;
    }
    private String quantity(double amount,int unit){
        boolean volume=unit<2;
        double base=(unit==0||unit==2)?amount:amount*1000;
        if(base>=1000)return fmt.format(base/1000)+(volume?" L":" kg");
        return fmt.format(base)+(volume?" mL":" g");
    }
    private void calculate(){
        if(areaText==null||countText==null)return;
        Double h=hectares();
        if(h==null){
            areaText.setText("— ha");areaDetail.setText("Informe tanque e taxa maiores que zero.");
        }else{
            SpannableString v=new SpannableString(fmt.format(h)+" ha");
            v.setSpan(new ForegroundColorSpan(MUTED),fmt.format(h).length(),v.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            areaText.setText(v);
            areaDetail.setText(fmt.format(positive(tank.getText().toString()))+" L ÷ "+fmt.format(positive(rate.getText().toString()))+" L/ha = "+fmt.format(h)+" hectares");
        }
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(h==null||d==null){p.resultLabel.setText("aguardando dados");p.resultLabel.setTextColor(MUTED);}
            else {int u=p.unit.getSelectedItemPosition();if(u<0)u=0;
                p.resultLabel.setText(quantity(h*d,u));p.resultLabel.setTextColor(0xFF087A35);complete++;}
        }
        countText.setText(complete+"/"+products.size()+" PRODUTOS CALCULADOS");
        if(!restoring)save();
    }
    private void save(){
        try{
            JSONObject root=new JSONObject();
            root.put("tank",tank.getText().toString());root.put("rate",rate.getText().toString());
            JSONArray arr=new JSONArray();
            for(Product p:products){JSONObject o=new JSONObject();o.put("name",p.name.getText().toString());o.put("dose",p.dose.getText().toString());o.put("unit",p.unit.getSelectedItemPosition());arr.put(o);}
            root.put("products",arr);
            store.edit().putString("state",root.toString()).apply();
        }catch(Exception ignored){}
    }
    private void restore(){
        restoring=true;
        try{
            JSONObject root=new JSONObject(store.getString("state","{}"));
            tank.setText(root.optString("tank",""));rate.setText(root.optString("rate",""));
            JSONArray arr=root.optJSONArray("products");
            if(arr!=null)for(int i=0;i<arr.length();i++){
                JSONObject o=arr.optJSONObject(i);if(o!=null)addProduct(o.optString("name",""),o.optString("dose",""),o.optInt("unit",0));
            }
        }catch(Exception ignored){}
        if(products.isEmpty())addProduct("","",0);
        restoring=false;
    }
    private void copySummary(){
        Double h=hectares();if(h==null){Toast.makeText(this,"Informe tanque e taxa primeiro.",Toast.LENGTH_SHORT).show();return;}
        StringBuilder s=new StringBuilder("MBA CALDA — RESUMO\n");
        s.append("Tanque: ").append(tank.getText()).append(" L\nTaxa: ").append(rate.getText()).append(" L/ha\n");
        s.append("Área por tanque: ").append(fmt.format(h)).append(" ha\n\nPRODUTOS POR TANQUE:\n");
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(d==null)continue;
            int u=Math.max(0,p.unit.getSelectedItemPosition());
            String name=p.name.getText().toString().trim();if(name.isEmpty())name="Produto "+(complete+1);
            s.append("• ").append(name).append(": ").append(quantity(h*d,u)).append(" (dose ").append(fmt.format(d)).append(" ").append(UNITS[u]).append(")\n");complete++;
        }
        if(complete==0){Toast.makeText(this,"Informe ao menos uma dose de produto.",Toast.LENGTH_SHORT).show();return;}
        s.append("\nComplete com água até o volume FINAL do tanque. Confira a bula e a compatibilidade da mistura.");
        ClipboardManager clipboard=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        if(clipboard!=null)clipboard.setPrimaryClip(ClipData.newPlainText("Resumo MBA Calda",s.toString()));
        Toast.makeText(this,"Resumo copiado!",Toast.LENGTH_SHORT).show();
    }
    private void confirmClear(){
        new AlertDialog.Builder(this).setTitle("Limpar cálculo?")
            .setMessage("Apagar os valores e todos os produtos adicionados?")
            .setNegativeButton("Cancelar",null).setPositiveButton("Limpar",(d,w)->{
                restoring=true;tank.setText("");rate.setText("");products.clear();list.removeAllViews();
                addProduct("","",0);restoring=false;calculate();
                Toast.makeText(this,"Campos limpos",Toast.LENGTH_SHORT).show();
            }).show();
    }

    /** Faint engineering grid and diffuse lime-green ambient bloom. */
    private class GridDrawable extends Drawable {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas c){
            Rect bounds=getBounds();
            p.setShader(new LinearGradient(0,0,0,bounds.height(),
                0xFFF8FCF7,0xFFEAF5E7,Shader.TileMode.CLAMP));
            c.drawRect(bounds,p);p.setShader(null);
        }
        @Override public void setAlpha(int a){}
        @Override public void setColorFilter(android.graphics.ColorFilter f){}
        @Override public int getOpacity(){return PixelFormat.OPAQUE;}
    }
    
    private class CropIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        CropIcon(Context c){super(c);} 
        @Override protected void onDraw(Canvas raw){super.onDraw(raw);
            Canvas c=raw;int save=c.save();c.scale(getWidth()/70f,getHeight()/60f);
            p.setColor(0xFF137B36);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2.1f);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(35,29,35,9,p);
            Path leaf=new Path();leaf.moveTo(35,22);leaf.cubicTo(16,20,18,5,21,5);leaf.cubicTo(37,6,35,20,35,22);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(35,21);leaf.cubicTo(48,3,58,9,57,12);leaf.cubicTo(57,21,42,23,35,21);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(8,35);leaf.quadTo(35,26,63,35);c.drawPath(leaf,p);
            for(int i=0;i<3;i++){leaf.reset();leaf.moveTo(7+i*3,42+i*8);leaf.quadTo(35,32+i*7,63-i*3,42+i*8);c.drawPath(leaf,p);}
            c.restoreToCount(save);
        }
    }
    private class TrashIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        TrashIcon(Context c){super(c);setBackground(shape(0xFFEAF7E4,Color.TRANSPARENT,8));}
        @Override protected void onDraw(Canvas c){super.onDraw(c);
            float mid=getWidth()/2f,top=getHeight()/2f;
            p.setColor(DARK);p.setStrokeWidth(dp(1.7f));p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(mid-dp(9),top-dp(8),mid+dp(9),top-dp(8),p);
            c.drawLine(mid-dp(4),top-dp(11),mid+dp(4),top-dp(11),p);
            c.drawRoundRect(mid-dp(7),top-dp(5),mid+dp(7),top+dp(11),dp(2),dp(2),p);
            c.drawLine(mid-dp(2.5f),top-dp(2),mid-dp(2.5f),top+dp(7),p);
            c.drawLine(mid+dp(2.5f),top-dp(2),mid+dp(2.5f),top+dp(7),p);
        }
    }
}