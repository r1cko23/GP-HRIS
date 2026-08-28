create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassWTAX]
				  
@idclient varchar(20),
@PayrollPeriodStart Date


--@idemployee INT,
--@idDepartment INT,
--@idclientbranch INT,
--@grossamt float,
--@basicamt float,
--@otherbasisamt float,
--@UserName varchar(20),
--@withsss bit,
--@withssspro bit,
--@withphi bit,
--@withpag bit,
--@idpayroll int
AS
BEGIN

DECLARE @idemployee0 INT
DECLARE @idpayroll0 INT
DECLARE @sssbasis0 NVARCHAR(20)
DECLARE @grossamt0 float
DECLARE @basicamt0 float
DECLARE @otherbasisamt0 float
DECLARE @withsss NVARCHAR(20)
DECLARE @withssspro NVARCHAR(20)
DECLARE @withphi NVARCHAR(20)
DECLARE @withpag NVARCHAR(20)


DECLARE myCursor0 CURSOR FOR
SELECT idpayrollsum,employee_id,sssbasis,grossalary,basic,othermandatorybasis,withsss,withssspro,withphi,withpag
FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart order by idpayrollsum
OPEN myCursor0
   
   FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				
		   
----------------------Wtax-------------------------------------------

	--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17


 DECLARE @WTAXCOMPENSATION FLOAT
 DECLARE @TOTALMANDATORIES  FLOAT
 DECLARE @TAXABLEINCOME FLOAT
 
 
 DECLARE @TAXCOMPENSATIONLEVEL FLOAT
 DECLARE @TAXOVER FLOAT
 DECLARE @TAXPERCENT FLOAT
 DECLARE @TAXPRESCRIBE FLOAT 
 DECLARE @WTAXCOMPENSATIONFINAL FLOAT

  DECLARE @finalssseegross2 FLOAT
  DECLARE @phieebasic2 FLOAT 
  DECLARE @pageebasic2 FLOAT
  DECLARE @finalssseegross2pro FLOAT



SELECT @finalssseegross2= COALESCE(Sum(contributionSSSEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0

SELECT @finalssseegross2pro= COALESCE(Sum(contributionSSSEEPRO),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0				
			
SELECT @phieebasic2= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0

SELECT @pageebasic2= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0






SET @TOTALMANDATORIES=  @finalssseegross2+@phieebasic2+@pageebasic2+@finalssseegross2pro
SET @TAXABLEINCOME = @grossamt0 -COALESCE(@TOTALMANDATORIES,0)
 
SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc


SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL

	
SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
	--SET @WTAXCOMPENSATIONFINAL  = @TAXCOMPENSATIONLEVEL
SET @WTAXCOMPENSATIONFINAL  =@WTAXCOMPENSATION +@TAXPRESCRIBE 																  

IF @idclient IN (171,173,74)
BEGIN
    UPDATE payroll_summary
    SET Wtax = @WTAXCOMPENSATIONFINAL                  
    WHERE idpayrollsum = @idpayroll0 and trxtypep ='Normal'
END

IF @idclient IN (105)
BEGIN
    UPDATE payroll_summary
    SET Wtax =   @WTAXCOMPENSATIONFINAL 
    WHERE idpayrollsum = @idpayroll0  and idbranchpositionp IN (5723,5726,5659,5736,5622)  and trxtypep ='Normal'
END
	


	FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag
END
CLOSE myCursor0
DEALLOCATE myCursor0
 


END	

-----------------------------End of Tax--------------------------------------------------





/*
 
----------------------------------------- RUN OTHER DEDUCTION HERE -------------------------------------------
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17


Declare @Didemployee int
Declare @Damount varchar(20)
DECLARE @DConcatenatedValue VARCHAR(MAX)
DECLARE @Didpayrollsum varchar(20)
DECLARE @Dsqldeductionupdate Nvarchar(max)
declare @Dsqlotherdeductionupdatepayrollsum Nvarchar(max)
DECLARE @Diddeduction varchar(20)
DECLARE @Dtotalamount varchar(20)
DECLARE @Dtotalamount2 varchar(20)

DECLARE @Dtotalsss varchar(20)
DECLARE @Dtotalphi varchar(20)
DECLARE @Dtotalpag varchar(20)

DECLARE @DGrosssalary varchar(20)
DECLARE @Dtotaldeduction1 varchar(20)
DECLARE @DNetamount varchar(20)
DECLARE @DNetamount2 varchar(20)


DECLARE myCursor1 CURSOR FOR
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  and employee_id = @idemployee0 order by idotherdeduction
	  
	OPEN myCursor1
   
	FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @Didpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @Didemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart AND idpayrollsum = @idpayroll0   order by grossalary desc
	  	   
		   --update OTHERDEDUCTION table idpayrollsum system assure that high gross amt should be place 
			SET @Dsqldeductionupdate = ('UPDATE otherdeduction SET idpayrollsum=' + @Didpayrollsum + ' WHERE idotherdeduction='+ @Diddeduction + '')
			execute(@Dsqldeductionupdate)

			--totalamount  adjusment
			SELECT @Dtotalamount= COALESCE(Sum(amount),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 
			SELECT @Dtotalamount2= COALESCE(Sum(amount2),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 

		 SET @Dsqlotherdeductionupdatepayrollsum = ('UPDATE payroll_summary SET Other_Deduction=' + @Dtotalamount + ' ,Other_Deduction2=' + @Dtotalamount2 + '  WHERE idpayrollsum='+ @Didpayrollsum + '')
			execute(@Dsqlotherdeductionupdatepayrollsum)
					   
	
		   FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
    END
	CLOSE myCursor1
	DEALLOCATE myCursor1
-----------------------------------------ENd Other deduction---------------------------------------------------- 





---------------------------------------------Total net amount and others Single------------------------------------------

--DECLARE @idclient int =4
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 98


DECLARE @Tidpayrollsum varchar(20)
DECLARE @TEmployee_id varchar(20)
DECLARE @countempidfinal int

DECLARE @Tsqltotaldeduction float
DECLARE @Tsqltotaldeduction2 float

declare @Tsqltotalnet float
declare @Tsqltotalnet2 float

DECLARE @Totherdeduction float
DECLARE @Totherdeduction2 float

DECLARE @TTotaldeduction float
DECLARE @Ttotaldeduction2 float

DECLARE @Tsss float
DECLARE @Tssspro float
DECLARE @Tphi float
DECLARE @Tpag float
DECLARE @Twtax float

DECLARE @TGrosssalary float
DECLARE @TNetamount float
DECLARE @TNetamount2 float


DECLARE myCursor5 CURSOR FOR
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart  and employee_id = @idemployee0 and idpayrollsum = @idpayroll0
	  
	OPEN myCursor5
   
	FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@TEmployee_id
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		
			--- get the max idpayroll
			--SELECT TOP 1  @maxidpayrollsumfinal = idpayrollsum FROM payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			
		
			SELECT @Tsss= contributionSSSEE from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tssspro= contributionSSSEEpro from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Twtax= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tssspro as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Twtax as float)+CAST(@Totherdeduction as float)	

			
			--continue here add condition (empid date start idclientp) problem with data type 
			--IF @countempidfinal = 1 --only one trx 
			UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction   WHERE idpayrollsum=@Tidpayrollsum 
			
			--	SET @Tsqltotaldeduction = 'UPDATE payroll_summary SET Totaldeduction=' + @TTotaldeduction + '  WHERE idpayrollsum='+ @Tidpayrollsum + ''
			--	ELSE IF @countempidfinal >1 
			--	SET @Tsqltotaldeduction = 'UPDATE payroll_summary SET Totaldeduction = ' + @TTotaldeduction + ' WHERE idpayrollsum =  ' + @Tidpayrollsum + ''
				--SET @Tsqltotaldeduction2 ='UPDATE payroll_summary SET Totaldeduction = ' + @TTotaldeduction + ' WHERE idpayrollsum <> ' + @Tidpayrollsum + ' AND employee_id = ' + @TEmployee_id + ' AND idclientp = ' + CAST(@idclient AS NVARCHAR(20)) + ' AND date_start = ''' + CONVERT(NVARCHAR(30), @PayrollPeriodStart, 23) + ''''
			

		--	BEGIN TRANSACTION; 
		--	execute(@Tsqltotaldeduction)
		--  execute(@Tsqltotaldeduction2)
		--	COMMIT;

			SELECT @TGrosssalary = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			
			--SELECT @TNetamount = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)	

			SELECT @TNetamount = CAST(@TGrosssalary AS DECIMAL(18,2)) - CAST(@TTotaldeduction AS DECIMAL(18,2));
			
			SELECT @TNetamount2 = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)+@Totherdeduction2
			
			--IF @countempidfinal = 1 --only one payroll
			UPDATE payroll_summary SET netamount= @TNetamount  ,netamount2= @TNetamount2   WHERE idpayrollsum= @Tidpayrollsum 
			
			
			--	SET @Tsqltotalnet = 'UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + '  WHERE idpayrollsum='+ @Tidpayrollsum + ''
			
			--ELSE IF @countempidfinal >1 --more the 1 payroll
			--	SET @Tsqltotalnet = 'UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + '  WHERE idpayrollsum = ' + @maxidpayrollsumfinal + ' AND employee_id = ' + @TEmployee_id + ' AND idclientp = ' + CAST(@idclient AS NVARCHAR(20)) + ' AND date_start = ''' + CONVERT(NVARCHAR(30), @PayrollPeriodStart, 23) + '''' 
			--	SET @Tsqltotalnet2 = 'UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + ' WHERE idpayrollsum <>' + @maxidpayrollsumfinal + ' AND employee_id = ' + @TEmployee_id + ' AND idclientp = ' + CAST(@idclient AS NVARCHAR(20)) + ' AND date_start = ''' + CONVERT(NVARCHAR(30), @PayrollPeriodStart, 23) + '''' 
						
			
		--	BEGIN TRANSACTION; 
		--	execute(@Tsqltotalnet)
		--	execute(@Tsqltotalnet2)
		--	COMMIT;
			
		   FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@TEmployee_id
    END
	CLOSE myCursor5
	DEALLOCATE myCursor5
	  	  -------------------------------------- End Total Net amount --------------------------------------------------------





   
---------------------------------NETAMOUNT <2000-------------------------------------
DECLARE @idemployee2K int  
DECLARE @TGrosssalary6 FLOAT
DECLARE @Tnetamount6 FLOAT

DECLARE @netamount2K int 
DECLARE @sumnetamount2K float
DECLARE @idpayrollsum6	int


DECLARE @TTotaldeduction6 float
DECLARE @Ttotaldeduction26 float

DECLARE @Totherdeduction6 float
DECLARE @Totherdeduction26 float

DECLARE @Tsss6 float
DECLARE @Tphi6 float
DECLARE @Tpag6 float
DECLARE @Twtax6 float


DECLARE myCursor6 CURSOR FOR

-- open payroll summary      
SELECT employee_id,@netamount2K FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and  employee_id = @idemployee0 and netamount <=2000 order by idpayrollsum

 
	OPEN myCursor6
   
   FETCH NEXT FROM myCursor6 INTO @idemployeE2K,@netamount2k
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum6=  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				--SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
			
	update payroll_summary
	set contributionSSSEE =0, contributionSSSER = 0, contributionSSSECC = 0,
	contributionphilhealthEE = 0, contributionphilhealthER = 0,
	contributionPagibigEE = 0,contributionPagibigER = 0, 
	withsss = 'N', withphi ='N', withpag ='N', withssspro = 'N'		 
	where idpayrollsum = @idpayrollsum6


	SELECT @Tsss6= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tphi6= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tpag6= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Twtax6= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
						
	SELECT @Totherdeduction6= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 
	--SELECT @Totherdeduction26= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 

	SELECT @TGrosssalary6 = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6

	SELECT @TTotaldeduction6 = CAST(@Tsss6 as float)+CAST(@Tphi6 as float)+CAST(@Tpag6 as float)+CAST(@Twtax6 as float)+CAST(@Totherdeduction6 as float)

			
	UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction6   WHERE idpayrollsum=@idpayrollsum6 

	SELECT @TNetamount6 = CAST(@TGrosssalary6 as float)-CAST(@TTotaldeduction6 as float)					
	UPDATE payroll_summary SET netamount= @TNetamount6  ,netamount2= @TNetamount6   WHERE idpayrollsum= @Tidpayrollsum 


   FETCH NEXT FROM myCursor6 INTO @idemployeE2K,@netamount2k
	END
	CLOSE myCursor6
	DEALLOCATE myCursor6





-----------------------------------------END <2000-----------------------------------





FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag
END
CLOSE myCursor0
DEALLOCATE myCursor0
  


END

 */










/*
---------------------------------------------Total net amount and others Double------------------------------------------

--DECLARE @idclient int =4
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 98


DECLARE @Tidpayrollsumdouble varchar(20)
DECLARE @TEmployee_iddouble varchar(20)
DECLARE @countempidfinaldouble int

DECLARE @Tsqltotaldeductiondouble Nvarchar(max)
DECLARE @Tsqltotaldeduction2double Nvarchar(max)

declare @Tsqltotalnetdouble Nvarchar(max)
declare @Tsqltotalnet2double Nvarchar(max)

DECLARE @Totherdeductiondouble varchar(20)
DECLARE @Totherdeduction2double varchar(20)

DECLARE @TTotaldeductiondouble varchar(20)
DECLARE @Ttotaldeduction2double varchar(30)

DECLARE @Tsssdouble varchar(30)
DECLARE @Tphidouble varchar(30)
DECLARE @Tpagdouble varchar(30)

DECLARE @TGrosssalarydouble varchar(30)
DECLARE @TNetamountdouble varchar(30)
DECLARE @TNetamount2double varchar(30)


DECLARE myCursor6 CURSOR FOR
--- insert here the script with double payroll change parameter to dynamic
SELECT        idpayrollsum, Employee_id
FROM            payroll_summary
WHERE        (Employee_id IN
                             (SELECT        Employee_id
                               FROM            payroll_summary AS payroll_summary_1
                               GROUP BY Employee_id, idclientp, Date_Start
                               HAVING         (COUNT(*) > 1) AND (Date_Start = @PayrollPeriodStart) AND (idclientp = @idclient) and (Employee_id = @idemployee))) AND (idclientp = @idclient) AND (Date_Start = @PayrollPeriodStart)
ORDER BY Employee_id


	OPEN myCursor6
   
	FETCH NEXT FROM myCursor6 INTO @Tidpayrollsumdouble,@TEmployee_iddouble
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		
			--- get the max idpayroll
			--SELECT TOP 1  @maxidpayrollsumfinal = idpayrollsum FROM payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			--SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_iddouble and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			
		
			SELECT @Tsssdouble= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Tphidouble= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Tpagdouble= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
						
			SELECT @Totherdeductiondouble= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Totherdeduction2double= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble

			SELECT @TTotaldeductiondouble = CAST(@Tsssdouble as float)+CAST(@Tphidouble as float)+CAST(@Tpagdouble as float)+CAST(@Totherdeductiondouble as float)	
								
			
			 UPDATE payroll_summary SET Totaldeduction =  @TTotaldeductiondouble WHERE idpayrollsum =  @Tidpayrollsumdouble 
			
			--SET @Tsqltotaldeductiondouble = 'UPDATE payroll_summary SET Totaldeduction = ' + @TTotaldeductiondouble + ' WHERE idpayrollsum =  ' + @Tidpayrollsumdouble + ''
			
			--BEGIN TRANSACTION; 
			--	execute(@Tsqltotaldeductiondouble)			
			--	execute(@Tsqltotaldeduction2double)
			--COMMIT;
			

			SELECT @TGrosssalarydouble = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @TNetamountdouble = CAST(@TGrosssalarydouble as float)-CAST(@TTotaldeductiondouble as float)	
			SELECT @TNetamount2double =CAST(@TGrosssalarydouble as float)-CAST(@TTotaldeductiondouble as float)+@Totherdeduction2double
			
			UPDATE payroll_summary SET netamount=@TNetamountdouble ,netamount2=  @TNetamount2double   WHERE idpayrollsum= @Tidpayrollsumdouble 
			
			--SET @Tsqltotalnetdouble = 'UPDATE payroll_summary SET netamount=' + @TNetamountdouble + ' ,netamount2=' + @TNetamount2double + '  WHERE idpayrollsum='+ @Tidpayrollsumdouble + ''
			
			--BEGIN TRANSACTION; 
			--execute(@Tsqltotalnetdouble)
			--execute(@Tsqltotalnet2double)
			--COMMIT;
			
		   FETCH NEXT FROM myCursor6 INTO @Tidpayrollsumdouble,@TEmployee_iddouble
    END
	CLOSE myCursor6
	DEALLOCATE myCursor6
	  	  -------------------------------------- End Total Net amount Double--------------------------------------------------------
*/


--select [sssemployee]=@finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2, [sssemployeepro]=@finalssseegross2pro,[sssemployerpro]=@finalsssergross2pro, [Philhealthee] = @phieebasic2,[pagibigee]=@pageebasic2,[withpag]=@withpag,[wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL
--select [sssemployee]=@finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2, 







   	 
--use below script to test the value computed by script above  
--DECLARE @idemployee int =5250
--DECLARE @idclient int =30
--declare @idDepartment int = 107
--DECLARE @PayrollPeriodStart date = '2023-06-01'
--DECLARE @idclientbranch int =31
--DECLARE @grossamt float = 7280.56
--DECLARE @basicamt float = 6840
--DECLARE @UserName varchar(20)= 'pat'
--Declare @withsss bit = 'True'
--Declare @withphi bit = 'True'
--Declare @withpag bit = 'True'
--Declare @idpayroll int = 2765

--execute [42bf00bd-6230-462f-a118-a3d93166c3b9V215IND] @idemployee,@idclient,@idDepartment, @PayrollPeriodStart,@idclientbranch,@grossamt,@basicamt,@UserName,@withsss,@withphi,@withpag,@idpayroll

 

 









