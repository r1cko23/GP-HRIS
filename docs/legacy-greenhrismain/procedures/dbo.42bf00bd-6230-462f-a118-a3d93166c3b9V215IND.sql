CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215IND]

@idemployee INT,
@idclient varchar(20),
@idDepartment INT,
@PayrollPeriodStart Date,
@idclientbranch INT,
@grossamt float,
@basicamt float,
@UserName varchar(20),
@withsss bit,
@withssspro bit,
@withphi bit,
@withpag bit,
@idpayroll int
AS
BEGIN
------------------------------------------------------SSS Process 15th-------------------------------------------
--DECLARE @idemployee int =2229
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 17


 declare @currentday INT
 declare @cut2start INT
 declare @idemployeesss int
 declare @counter int = 0
 declare @sssbasis varchar(7)
 DECLARE @countempidsss int
 DECLARE @idpayrollsum2 varchar(20)
 DECLARE @ConcatenatedValue2 VARCHAR(MAX)
 
 DECLARE @forssstotalgross float
 DECLARE @forssstotalgross2 float
 DECLARE @ssseegross as float 
 DECLARE @sssergross as float
 DECLARE @ssseccgross as float
 
 declare @finalssseegross Float
 declare @finalssseegross2 as float
 declare @finalssseebasic  as float
 declare @finalssseebasic2 as float

 
 declare @finalsssergross as float
 declare @finalsssergross2 as float 
 declare @finalssserbasic as float
 declare @finalssserbasic2 as float
 
 declare @finalssseccgross as float
 declare @finalssseccgross2 as float
 declare @finalssseccbasic as float
 declare @finalssseccbasic2 as float
   
  

 DECLARE @forssstotalbasic float
 DECLARE @forssstotalbasic2 float
 

 DECLARE @ssseebasic as float 
 DECLARE @ssserbasic as float
 declare @ssseccbasic as float
 DECLARE @eccbasic as float 

 
 


 
DECLARE myCursor2 CURSOR FOR
-- open payroll summary      
SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment and employee_id = @idemployee order by idpayrollsum

--SELECT employee_id,sssbasis FROM payroll_summary where  idpayrollsum =24260
 
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll
				
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll
				

				--SELECT @forssstotalgross= SELeCT Sum(grossalary) as ssf from payroll_summary WHERE idpayrollsum <>26406 and idclientp = 17 and Date_Start ='2023-04-01'
				--select @forssstotalgross2=@grossamt+@forssstotalgross
				
				select @forssstotalgross2=@grossamt
				select @forssstotalbasic2=@basicamt



				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forssstotalgross2 order by Range desc
				SELECT TOP 1  @sssergross = EmployerSSS FROM SSS where Range <= @forssstotalgross2 order by Range desc
				SELECT TOP 1  @ssseccgross = EmployerECC FROM SSS where Range <= @forssstotalgross2 order by Range desc
				
				

				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll
				
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forssstotalbasic2 order by Range desc
				SELECT TOP 1  @ssserbasic = EmployerSSS FROM SSS where Range <= @forssstotalbasic2 order by Range desc
				SELECT TOP 1  @ssseccbasic =   EmployerECC FROM SSS where Range <= @forssstotalbasic2 order by Range desc
				

--------EMPLOYEEE GROSS PROCESS		
				--declare @finalssseegross float
				SET @finalssseegross =
						CASE 
							WHEN @forssstotalgross2 <= 1000.0 THEN 0.0
							WHEN @forssstotalgross2 > 1000.0 THEN @ssseegross
						END
					
					--------EMPLOYER GROSS PROCESS		
				Set @finalsssergross =
							CASE 
								WHEN @forssstotalgross2 <=1000.0 THEN 0
								WHEN @forssstotalgross2 >1000.0 THEN @sssergross
							END
					
				--------ECC GROSS PROCESS		
				Set @finalsssECCgross =
							CASE 
								WHEN @grossamt <=1000 THEN 0
								WHEN @grossamt >1000 THEN @ssseccgross
							END

					
--------EMPLOYEEE BASIC PROCESS		
	SET @finalssseebasic =
						CASE 
							WHEN @forssstotalbasic2 <= 1000.0 THEN 0.0
							WHEN @forssstotalbasic2 > 1000.0 THEN @ssseebasic
						END
					
					--------EMPLOYER BASIC PROCESS		
				Set @finalssserbasic =
							CASE 
								WHEN @forssstotalbasic2 <=1000.0 THEN 0
								WHEN @forssstotalbasic2 >1000.0 THEN @ssserbasic
							END
					
				--------ECC BASIC PROCESS		
				Set @finalsssECCbasic =
							CASE 
								WHEN @basicamt <=1000.0 THEN 0
								WHEN @basicamt >1000.0 THEN @ssseccbasic
							END
			

			--condition fall in gross or basic reference


			if @sssbasis = 'Gross' and @countempidsss=1 and @withsss=1 
		  		Begin
					SET @finalssseegross2 = @finalssseegross
					SET @finalsssergross2 = @finalsssergross
					SET @finalssseccgross2 = @finalsssECCgross

					--Print 'Gross' 
					--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@sssergross,contributionSSSECC =@finalsssECCgross where idpayrollsum=@idpayrollsum2
				End

				else if @sssbasis = 'Gross' and @countempidsss >1  and @withsss=1 --if more than 2 records
		  				BEgin		
							SET @finalssseegross2 = @finalssseegross
							SET @finalsssergross2 = @finalsssergross
							SET @finalssseccgross2 = @finalsssECCgross
							--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@finalsssergross,contributionSSSECC=@finalsssECCgross where idpayrollsum=@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						   --update other sssee to zero 
						--	update payroll_summary set contributionSSSEE =0,contributionSSSER=0,contributionSSSECC =0 where idpayrollsum<>@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						End 
			


			if @sssbasis = 'Basic' and @countempidsss =1 and  @withsss =1 
			Begin
				SET @finalssseegross2 = @finalssseebasic
				SET @finalsssergross2 = @finalssserbasic
				SET @finalssseccgross2 = @finalsssECCbasic								
			--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 
			
			else if @sssbasis = 'Basic' and @countempidsss >1  and @withsss=1 --if more than 2 records basic reference
		  	
			BEgin		
				SET @finalssseegross2 = @finalssseebasic
				SET @finalsssergross2 = @finalssserbasic
				SET @finalssseccgross2 = @finalsssECCbasic
			End 
			


	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2
	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------

	   	  

-----------------------------------------------------------------SSS PRO-----------------------------------------------------------------


--DECLARE @idemployee int =2229
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 17


 declare @currentdaypro INT
 declare @cut2startpro INT
 declare @idemployeessspro int
 declare @counterpro int = 0
 declare @sssbasispro varchar(7)
 DECLARE @countempidssspro int
 DECLARE @idpayrollsum2pro varchar(20)
 DECLARE @ConcatenatedValue2pro VARCHAR(MAX)
 
 DECLARE @forssstotalgrosspro float
 DECLARE @forssstotalgross2pro float
 DECLARE @ssseegrosspro as float 
 DECLARE @sssergrosspro as float

 
 declare @finalssseegrosspro Float
 declare @finalssseegross2pro as float 
 
 declare @finalsssergrosspro as float
 declare @finalsssergross2pro as float 

  
 DECLARE @forssstotalbasicpro float
 DECLARE @ssseebasicpro as float 
 DECLARE @ssserbasicpro as float

 


 
DECLARE myCursor7 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment and employee_id = @idemployee order by idpayrollsum

--SELECT employee_id,sssbasis FROM payroll_summary where  idpayrollsum =24260
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeessspro,@sssbasispro
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum2pro =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				SELECT @countempidssspro =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forssstotalgrosspro= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll
				--SELECT @forssstotalgross= SELeCT Sum(grossalary) as ssf from payroll_summary WHERE idpayrollsum <>26406 and idclientp = 17 and Date_Start ='2023-04-01'
															
				select @forssstotalgross2pro=@grossamt+@forssstotalgrosspro


		
				SELECT TOP 1  @ssseegrosspro = eepro FROM SSS where Range <= @forssstotalgross2pro order by Range desc
				SELECT TOP 1  @sssergrosspro = erpro FROM SSS where Range <= @forssstotalgross2pro order by Range desc
				
				SELECT @forssstotalbasicpro= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				SELECT TOP 1  @ssseebasicpro = eepro FROM SSS where Range <= @forssstotalgross2 order by Range desc --it should be basic shoul be fix later on 
				SELECT TOP 1  @ssserbasicpro = erpro FROM SSS where Range <= @forssstotalgross2 order by Range desc -- it should be basic shoul be fix later on
				

				--------EMPLOYEEE GROSS PROCESS		
				--declare @finalssseegross float
				SET @finalssseegrosspro =
						CASE 
							WHEN @forssstotalgross2pro <= 1000.0 THEN 0.0
							WHEN @forssstotalgross2pro > 1000.0 THEN @ssseegrosspro
						END
					
					--------EMPLOYER GROSS PROCESS		
				Set @finalsssergrosspro =
							CASE 
								WHEN @forssstotalgross2pro <=1000.0 THEN 0
								WHEN @forssstotalgross2pro >1000.0 THEN @sssergrosspro
							END
					
		
			if @sssbasispro = 'Gross' and @countempidssspro=1 and @withssspro=1 
		  		Begin
					SET @finalssseegross2pro = @finalssseegrosspro
					SET @finalsssergross2pro = @finalsssergrosspro
				
					--Print 'Gross' 
					--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@sssergross,contributionSSSECC =@finalsssECCgross where idpayrollsum=@idpayrollsum2
				End

				else if @sssbasispro = 'Gross' and @countempidssspro >1  and @withsss=1 --if more than 2 records
		  				BEgin	
							SET @finalssseegross2pro = @finalssseegrosspro
							SET @finalsssergross2pro = @finalsssergrosspro
						
							--	update payroll_summary set contributionSSSEEpro = @finalssseegrosspro,contributionSSSERpro=@finalsssergrosspro where idpayrollsum=@idpayrollsum2pro and  Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart
							--update other sssee to zero 
							--	update payroll_summary set contributionSSSEE =0,contributionSSSER=0 where idpayrollsum<>@idpayrollsum2pro and  Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						End 
			
			if @sssbasis = 'Basic' and @countempidsss =1 and  @withsss =1 
				Begin
			print 'Basic'	
				--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 				

	FETCH NEXT FROM myCursor7 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7
	


-----------------------------------------------------------------------END SSSPRO ------------------------------------------------------

---------------------------------------------- Start Philhealth process --------------------------------------------------------------------

	
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

-- DECLARE @pConcatenatedValue2 VARCHAR(MAX)
declare @pcounter int = 0
DECLARE @pcurrentday INT
DECLARE @pcut2start INT
DECLARE @idemployeephi int

DECLARE @phibasis varchar(7)
DECLARE @pidpayrollsum2 varchar(20)
DECLARE @countempidphi int


DECLARE @forphitotalgross float
DECLARE @forphitotalbasic float
DECLARE @forphitotalbasic2 float
DECLARE @phiIDgross as int 
DECLARE @phiIDbasic as int

DECLARE @phieegross as float
DECLARE @phiergross as float

DECLARE @phieebasic as float
DECLARE @phieebasic2 as float
DECLARE @phierbasic as float
DECLARE @phierbasic2 as float

DECLARE @phieevalue1 as float
DECLARE @phiervalue1 as float
DECLARE @phieevalue3 as float 

DECLARE @phipercent as float
DECLARE @phipercent2 as float 
 
DECLARE @TDAYSPHI  AS FLOAT 


DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment and employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--	SET @pCounter = @pCounter + 1
				--- get the max idpayroll
			
				
				SELECT TOP 1  @pidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc --Get max idpayrollsumid 
				--count trx
				SELECT @countempidphi =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --Gross Basis
				SELECT @forphitotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum <> @idpayroll --Gross Basis
				SELECT @forphitotalgross= @grossamt
				
				SELECT @forphitotalbasic2= @basicamt+@forphitotalbasic
											   
				SELECT @TDAYSPHI= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
				
				SELECT TOP 1  @phiIDgross = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalgross order by Range desc -- get id from philheal2018 gross reference
				
				SELECT TOP 1  @phiIDbasic = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic2 order by Range desc --get id from philheal2018 basic reference
				
			
				SELECT  @phieevalue1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt ee
				SELECT  @phiervalue1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt er
				
				SELECT  @phipercent = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of percent
				SELECT  @phipercent2 = valPercentage FROM Philhealth_2018 where idphilhealth = 2 --CONSTANT ID TO GET THE RIGHT PERCENTAGE
				
				--EE COMPUTATION
				SET @phieegross = 
					CASE  
						WHEN @phiIDgross = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
						WHEN @phiIDgross = 2 THEN (@forphitotalgross*@phipercent)/2
						WHEN @phiIDgross = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
					END;
				--ER COMPUTATION
				SET @phiergross= 
					CASE  
						WHEN @phiIDgross = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
						WHEN @phiIDgross = 2 THEN (@forphitotalgross*@phipercent)/2
						WHEN @phiIDgross = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
					END;
				
				----BASIS IS basic OF employee							   					 				  
				SET @phieebasic =  
						CASE 
							WHEN @forphitotalgross >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN (@forphitotalbasic2*@phipercent)/2
								WHEN @phiIDbasic = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
							END
							ELSE
							0
						END;
				------------------------End Employee Computation -------------------------------------------------------


				--- Basic Employer---------------SAME AS PHILHEALTH EMPLOYE NO NEED TO ENHANCE
							
				SET @phierbasic= 
					CASE  
						WHEN @phiIDbasic = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
						WHEN @phiIDbasic = 2 THEN (@forphitotalbasic*@phipercent)/2
						WHEN @phiIDbasic = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
					END;
				----End Employer Computation 




			if @phibasis = 'Gross'	 --NOT YET ALIGN
	  			 update payroll_summary set contributionphilhealthEE = @phieegross,contributionphilhealthER=@phiergross where idpayrollsum=@pidpayrollsum2
				

			--- normal ALIGN
			if @phibasis = 'Basic' and @countempidphi =1 and @withphi =1 
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@pidpayrollsum2
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic
				End
			else if @phibasis = 'Basic' and @countempidphi >1  and @withphi =1 
				Begin
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic

					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@pidpayrollsum2 and  Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
					--	update payroll_summary set contributionphilhealthEE = 0,contributionphilhealthER=0 where idpayrollsum<>@pidpayrollsum2 and  Employee_id = @idemployeephi and idclientp = @idclient and Employee_id = @idemployeephi and Date_Start= @PayrollPeriodStart
				End	
			
	FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3


	---------------------------------------------- END Philhealth process --------------------------------------------------------------------


	---------------------------------------------- Start Pagibig process --------------------------------------------------------------------

	
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17


 declare @pagcurrentday INT
 declare @pagcut2start INT
 declare @idemployeepag int
 declare @pagcounter int = 0
 declare @pagbasis varchar(7)
 DECLARE @idpayrollsum4 varchar(20)
 DECLARE @countempidpag int
 
 DECLARE @forpagtotalgross float
 DECLARE @pageegross as float 
 DECLARE @pagergross as float
 
 DECLARE @forpagtotalbasic float
 DECLARE @pageebasic as float 
 DECLARE @pageebasic2 as float 

 DECLARE @pagerbasic as float
 DECLARE @pagerbasic2 as float

 DECLARE @TDAYSPAG AS INTEGER 
 DECLARE @pagibigcontribution float 

     
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment and employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			--SET @Counter = @Counter + 1
			--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum4 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			--count trx
				SELECT @countempidpag =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				--SELECT @forpagtotalgross= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				--SELECT TOP 1  @pageegross = 100
				--SELECT TOP 1  @pagergross = 100
				SELECT TOP 1  @pagibigcontribution= pagibigcontributionee FROM pagibigtable where idpagibig = 1   order by dateupdate desc
			

			
				SELECT @forpagtotalgross = @grossamt
				SELECT @forpagtotalbasic = @basicamt				
				--SELECT @forpagtotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				
				SELECT @TDAYSPAG= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS			
				
				----basic employee	 philhealth						   					 				  
				SET @pageebasic =  
								
				---------------------normal  Process-----------------------------
						CASE 
							WHEN @forpagtotalgross > 1000.00 THEN @pagibigcontribution
							ELSE
							0
						END;

				----- Pagibig Employer  SAME EMPLOYEE

			SELECT TOP 1  @pagerbasic = @pagibigcontribution											   

			--if @pagbasis = 'Gross'
		  	--	update payroll_summary set contributionPagibigEE = @pageegross,contributionPagibigER=@pageegross where idpayrollsum=@idpayrollsum4
				--Print 'Gross'
			 if @pagbasis = 'Basic'	and @countempidpag=1 and @withpag=1					
				Begin
				--	update payroll_summary set contributionPagibigEE = @pageebasic,contributionPagibigER=@pageebasic where idpayrollsum=@idpayrollsum4
					--set @pageebasic2 = @pageebasic
					--set @pagerbasic2 = @pageebasic

					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic

				End
			else  if @pagbasis = 'Basic'and @countempidpag	>1 	and  @withpag=1 	
				Begin

					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic

				--	update payroll_summary set contributionPagibigEE = @pageebasic,contributionPagibigER=@pageebasic where idpayrollsum=@idpayrollsum4 and Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				--	update payroll_summary set contributionPagibigEE = 0,contributionPagibigER=0 where idpayrollsum<>@idpayrollsum4 and Employee_id = @idemployeepag and idclientp = @idclient and Employee_id = @idemployeepag and Date_Start= @PayrollPeriodStart
				--print 'Basic'		
				End
						

	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4


	----------------------Wtax-------------------------------------------

--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17
 DECLARE @wtaxbasis nvarchar(7)


	SELECT TOP 1  @wtaxbasis =  wtaxbasis FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart 
			

		DECLARE @WTAXCOMPENSATION FLOAT
		DECLARE @TOTALMANDATORIES  FLOAT
		DECLARE @TAXABLEINCOME FLOAT
 
 
		DECLARE @TAXCOMPENSATIONLEVEL FLOAT
		DECLARE @TAXOVER FLOAT
		DECLARE @TAXPERCENT FLOAT
		DECLARE @TAXPRESCRIBE FLOAT 
		DECLARE @WTAXCOMPENSATIONFINAL FLOAT
		
								   
		
		SET @TOTALMANDATORIES=  @finalssseegross2+@phieebasic2+@pageebasic2+@finalssseegross2pro
		
		
		if @wtaxbasis = 'gross'
		SET @TAXABLEINCOME = @grossamt -COALESCE(@TOTALMANDATORIES,0)
 		if @wtaxbasis = 'basic'
		SET @TAXABLEINCOME = @basicamt -COALESCE(@TOTALMANDATORIES,0)
		 	   

		SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Semi-Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
	
		SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL

		SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
		--SET @WTAXCOMPENSATIONFINAL  = @TAXCOMPENSATIONLEVEL
		SET @WTAXCOMPENSATIONFINAL  =@WTAXCOMPENSATION +@TAXPRESCRIBE
	
		--below test the value forwarded
		--SET @WTAXCOMPENSATIONFINAL  =@WTAXCOMPENSATION
	









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
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  and iddepartmentdeduction = @idDepartment  and employee_id = @idemployee order by idotherdeduction
	  
	OPEN myCursor1
   
	FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @Didpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @Didemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart  and department_codep = @idDepartment order by grossalary desc
	  	   
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
*/

/*

---------------------------------------------Total net amount and others Single------------------------------------------

--DECLARE @idclient int =4
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 98


DECLARE @Tidpayrollsum varchar(20)
DECLARE @TEmployee_id varchar(20)
DECLARE @countempidfinal int

DECLARE @Tsqltotaldeduction Nvarchar(max)
DECLARE @Tsqltotaldeduction2 Nvarchar(max)

declare @Tsqltotalnet Nvarchar(max)
declare @Tsqltotalnet2 Nvarchar(max)

DECLARE @Totherdeduction varchar(20)
DECLARE @Totherdeduction2 varchar(20)

DECLARE @TTotaldeduction varchar(20)
DECLARE @Ttotaldeduction2 varchar(30)

DECLARE @Tsss varchar(30)
DECLARE @Tphi varchar(30)
DECLARE @Tpag varchar(30)

DECLARE @TGrosssalary varchar(30)
DECLARE @TNetamount varchar(30)
DECLARE @TNetamount2 varchar(30)


DECLARE myCursor5 CURSOR FOR
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart and department_codep = @idDepartment and employee_id = @idemployee
	  
	OPEN myCursor5
   
	FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@TEmployee_id
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		
			--- get the max idpayroll
			--SELECT TOP 1  @maxidpayrollsumfinal = idpayrollsum FROM payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			
		
			SELECT @Tsss= contributionSSSEE from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Totherdeduction as float)	

			
			--continue here add condition (empid date start idclientp) problem with data type 
			IF @countempidfinal = 1 --only one trx 
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
			
			SELECT @TNetamount = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)	
			SELECT @TNetamount2 = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)+@Totherdeduction2
			
			IF @countempidfinal = 1 --only one payroll
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

select [sssemployee]=@finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2, [sssemployeepro]=@finalssseegross2pro,[sssemployerpro]=@finalsssergross2pro, [Philhealthee] = @phieebasic2,[pagibigee]=@pageebasic2,[withpag]=@withpag,[wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL

   	 
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

 





END



