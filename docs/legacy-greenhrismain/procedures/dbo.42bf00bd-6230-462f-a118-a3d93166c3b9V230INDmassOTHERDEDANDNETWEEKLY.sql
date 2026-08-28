
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassOTHERDEDANDNETWEEKLY]

@idclient int,
@PayrollPeriodStart Date,
@idpayroll int,
@idemployee  int
  


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
DECLARE @monthlysalary float 
DECLARE @fixrate0 varchar(1)

DECLARE myCursor0 CURSOR FOR
SELECT idpayrollsum,employee_id,sssbasis,grossalary,basic,othermandatorybasis,withsss,withssspro,withphi,withpag,fixmonthlyrate,othermandatorybasis,fixrate
FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart order by idpayrollsum
OPEN myCursor0
   
   FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	WHILE @@FETCH_STATUS = 0
	
	BEGIN



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
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  AND employee_id = @idemployee0 order by idotherdeduction
	  
	OPEN myCursor1
   
	FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @Didpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @Didemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart   order by grossalary desc
	  	   
		   --update OTHERDEDUCTION table idpayrollsum system assure that high gross amt should be place 
			SET @Dsqldeductionupdate = ('UPDATE otherdeduction SET idpayrollsum=' + @Didpayrollsum + ' WHERE idotherdeduction='+ @Diddeduction + '')
			execute(@Dsqldeductionupdate)

			--totalamount  adjusment
			SELECT @Dtotalamount= COALESCE(Sum(amount),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 
			SELECT @Dtotalamount2= COALESCE(Sum(amount2),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 

		 SET @Dsqlotherdeductionupdatepayrollsum = ('UPDATE payroll_summary SET Other_Deduction=' + @Dtotalamount + ' ,Other_Deduction2=' + @Dtotalamount2 + '  WHERE idpayrollsum='+ @Didpayrollsum + '')
			execute(@Dsqlotherdeductionupdatepayrollsum)
					   
	--  SET @ConcatenatedValue = CONCAT(CONVERT(VARCHAR, @id), ' | ', CONVERT(VARCHAR, @amount) , ' | ',CONVERT(VARCHAR, @idpayrollsum) )
	--  print @ConcatenatedValue	   
		   FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
    END
	CLOSE myCursor1
	DEALLOCATE myCursor1
-----------------------------------------ENd Other deduction---------------------------------------------------- 



---------------------------------------------Total net amount single 30th ------------------------------------------

--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

DECLARE @countempidfinal int
DECLARE @Tidpayrollsum varchar(20)
DECLARE @Temployee_id varchar(20)
DECLARE @Tsqltotaldeduction Nvarchar(max)
declare @Tsqltotalnet Nvarchar(max)

DECLARE @Totherdeduction float
DECLARE @Totherdeduction2 float
DECLARE @TTotaldeduction float

DECLARE @Tsss float
DECLARE @Tssspro float
DECLARE @Tphi float
DECLARE @Tpag float
DECLARE @Twtax float

DECLARE @TGrosssalary float
DECLARE @Ttotaldeduction1 float
DECLARE @TNetamount float
DECLARE @TNetamount2 float


DECLARE myCursor5 CURSOR FOR
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart  AND employee_id = @idemployee0 AND idpayrollsum = @idpayroll0 order by idpayrollsum
	  
	OPEN myCursor5
   
	FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			  			
			SELECT @Tsss= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tssspro= COALESCE(contributionSSSEEpro,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Twtax= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tssspro as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Twtax as float)+CAST(@Totherdeduction as float)	

		--	IF @countempidfinal = 1 --only one trx 
			UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction   WHERE idpayrollsum=@Tidpayrollsum 
				

			SELECT @TGrosssalary = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			
			SELECT @TNetamount = ROUND(CAST(@TGrosssalary AS DECIMAL(18,2)) - CAST(@TTotaldeduction AS DECIMAL(18,2)), 2)	
			SELECT @TNetamount2 = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)+@Totherdeduction2
			
		--	IF @countempidfinal = 1 --only one payroll
			UPDATE payroll_summary SET netamount= @TNetamount  ,netamount2= @TNetamount2   WHERE idpayrollsum= @Tidpayrollsum 
			
			--SET @Tsqltotalnet = ('UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + '  WHERE idpayrollsum='+ @Tidpayrollsum + '')
			--execute(@Tsqltotalnet)
					   	   
		   FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
    END
	CLOSE myCursor5
	DEALLOCATE myCursor5
	  	  -------------------------------------- End Total Net amount single------------------------------------------------------






		     
---------------------------------NETAMOUNT <2000-------------------------------------
DECLARE @idemployee2K int  
DECLARE @TGrosssalary6 FLOAT
DECLARE @Tnetamount6 FLOAT

DECLARE @netamount2K int 
DECLARE @sumnetamount2K float
DECLARE @idpayrollsum6	int


DECLARE @TTotaldeduction6 varchar(20)
DECLARE @Ttotaldeduction26 varchar(30)

DECLARE @Totherdeduction6 float
DECLARE @Totherdeduction26 float

DECLARE @Tsss6 float
DECLARE @Tssspro6 float
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
				SELECT TOP 1  @idpayrollsum6=  idpayrollsum FROM payroll_summary where Employee_id = @idemployee2K and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				--SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
			
	update payroll_summary
	set contributionSSSEE =0, contributionSSSER = 0, contributionSSSECC = 0,
	contributionSSSEEPRO =0, contributionSSSERPRO = 0,
	contributionphilhealthEE = 0, contributionphilhealthER = 0,
	contributionPagibigEE = 0,contributionPagibigER = 0, 
	withsss = 'N', withphi ='N', withpag ='N', withssspro = 'N'		 
	where idpayrollsum = @idpayrollsum6


	SELECT @Tsss6= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tssspro6= COALESCE(contributionSSSEEPRO,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tphi6= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tpag6= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Twtax6= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
						
	SELECT @Totherdeduction6= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 
	--SELECT @Totherdeduction26= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 

	SELECT @TGrosssalary6 = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6

	SELECT @TTotaldeduction6 = CAST(@Tsss6 as float)+CAST(@Tssspro6 as float)+CAST(@Tphi6 as float)+CAST(@Tpag6 as float)+CAST(@Twtax6 as float)+CAST(@Totherdeduction6 as float)

			
	UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction6   WHERE idpayrollsum=@idpayrollsum6 

	SELECT @TNetamount6 = CAST(@TGrosssalary6 as float)-CAST(@TTotaldeduction6 as float)					
	UPDATE payroll_summary SET netamount= @TNetamount6  ,netamount2= @TNetamount6   WHERE idpayrollsum= @Tidpayrollsum 


   FETCH NEXT FROM myCursor6 INTO @idemployeE2K,@netamount2k
	END
	CLOSE myCursor6
	DEALLOCATE myCursor6




-----------------------------------------END <2000-----------------------------------



 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END













