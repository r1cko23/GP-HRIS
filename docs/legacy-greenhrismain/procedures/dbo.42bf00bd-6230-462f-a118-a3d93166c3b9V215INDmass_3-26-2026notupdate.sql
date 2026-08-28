create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmass 3-26-2026]
				  
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
 
 
 DECLARE @ssseegross as float 
 DECLARE @sssergross as float
 DECLARE @ssseccgross as float

 DECLARE @ssseebasic as float 
 DECLARE @ssserbasic as float
 declare @ssseccbasic as float

 DECLARE @ssseeotherbasis as float 
 DECLARE @ssserotherbasis as float
 declare @ssseccotherbasis as float



 DECLARE @forssstotalgross float
 DECLARE @forssstotalgross2 float
 DECLARE @forssstotalbasic float
 DECLARE @forssstotalbasic2 float
 DECLARE @forssstotalotherbasis float
 DECLARE @forssstotalotherbasis2 float
 
 declare @finalssseegross Float
 declare @finalssseegross2 as float
 declare @finalssseebasic  as float
 declare @finalssseebasic2 as float
 declare @finalssseeotherbasis  as float
 declare @finalssseeotherbasis2 as float

 
 declare @finalsssergross as float
 declare @finalsssergross2 as float 
 declare @finalssserbasic as float
 declare @finalssserbasic2 as float
 declare @finalssserotherbasis as float
 declare @finalssserotherbasis2 as float
 
 
 declare @finalssseccgross as float
 declare @finalssseccgross2 as float
 declare @finalssseccbasic as float
 declare @finalssseccbasic2 as float
 declare @finalssseccotherbasis as float
 declare @finalssseccotherbasis2 as float  
 DECLARE @eccbasic as float
 
 DECLARE @otherincome as float 

   
 
DECLARE myCursor2 CURSOR FOR
-- open payroll summary      
SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and  employee_id = @idemployee0 order by idpayrollsum

--SELECT employee_id,sssbasis FROM payroll_summary where  idpayrollsum =24260
 
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0
				
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0
				
				SELECT @forssstotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0

				--other income---------------
				SELECT @otherincome=  COALESCE(Sum(amount),0) 
				FROM adjustment INNER JOIN
                IncomeClass ON adjustment.codeadjustment = IncomeClass.codeadjustment
				WHERE employee_id = @idemployeesss 
				and  idclientincome = @idclient 
				and Date_Start= @PayrollPeriodStart 
				and idpayrollsum = @idpayroll0
				and IncomeClass.taxableincome = N'False'
					
		


				--plus if 2 entries
				select @forssstotalgross2=@grossamt0+@forssstotalgross-@otherincome
				select @forssstotalbasic2=@basicamt0+@forssstotalbasic
				select @forssstotalotherbasis2=@otherbasisamt0+@forssstotalotherbasis



				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forssstotalgross2 order by Range desc
				SELECT TOP 1  @sssergross = EmployerSSS FROM SSS where Range <= @forssstotalgross2 order by Range desc
				SELECT TOP 1  @ssseccgross = EmployerECC FROM SSS where Range <= @forssstotalgross2 order by Range desc
				
							
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forssstotalbasic2 order by Range desc
				SELECT TOP 1  @ssserbasic = EmployerSSS FROM SSS where Range <= @forssstotalbasic2 order by Range desc
				SELECT TOP 1  @ssseccbasic =   EmployerECC FROM SSS where Range <= @forssstotalbasic2 order by Range desc

				SELECT TOP 1  @ssseeotherbasis = EmployeeSSS FROM SSS where Range <= @forssstotalotherbasis2 order by Range desc
				SELECT TOP 1  @ssserotherbasis = EmployerSSS FROM SSS where Range <= @forssstotalotherbasis2 order by Range desc
				SELECT TOP 1  @ssseccotherbasis =   EmployerECC FROM SSS where Range <= @forssstotalotherbasis2 order by Range desc


				

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
								WHEN @forssstotalgross2 <=1000 THEN 0
								WHEN @forssstotalgross2 >1000 THEN @ssseccgross
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
								WHEN @forssstotalbasic2 <=1000.0 THEN 0
								WHEN @forssstotalbasic2 >1000.0 THEN @ssseccbasic
							END			
--END BASIC PROCESS


--------EMPLOYEEE OTHER BASIS PROCESS		

				SET @finalssseeotherbasis =
						CASE 
							WHEN @forssstotalotherbasis2 <= 1000.0 THEN 0.0
							WHEN @forssstotalotherbasis2 > 1000.0 THEN @ssseeotherbasis
						END
					
					--------EMPLOYER BASIC PROCESS		
				Set @finalssserotherbasis =
							CASE 
								WHEN @forssstotalotherbasis2 <=1000.0 THEN 0
								WHEN @forssstotalotherbasis2 >1000.0 THEN @ssserotherbasis
							END
					
				--------ECC BASIC PROCESS		
				Set @finalssseccotherbasis =
							CASE 
								WHEN @forssstotalotherbasis2 <=1000.0 THEN 0
								WHEN @forssstotalotherbasis2 >1000.0 THEN @ssseccotherbasis
							END			
--END OTHER BASIS PROCESS



			--condition fall in gross or basic reference			
			if @sssbasis = 'gross' and @countempidsss=1 and @withsss='Y'
		  		Begin
					SET @finalssseegross2 = @finalssseegross
					SET @finalsssergross2 = @finalsssergross
					SET @finalssseccgross2 = @finalsssECCgross

					--Print 'Gross' 
					--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@sssergross,contributionSSSECC =@finalsssECCgross where idpayrollsum=@idpayrollsum2
				End

				else if @sssbasis = 'gross' and @countempidsss >1  and @withsss='Y' --if more than 2 records
		  				BEgin		
							SET @finalssseegross2 = @finalssseegross
							SET @finalsssergross2 = @finalsssergross
							SET @finalssseccgross2 = @finalsssECCgross
							--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@finalsssergross,contributionSSSECC=@finalsssECCgross where idpayrollsum=@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						   --update other sssee to zero 
						--	update payroll_summary set contributionSSSEE =0,contributionSSSER=0,contributionSSSECC =0 where idpayrollsum<>@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						End 
			

			--condition fall in  basic reference		
			if @sssbasis = 'basic' and @countempidsss =1 and  @withsss ='Y' 
			Begin
				SET @finalssseegross2 = @finalssseebasic
				SET @finalsssergross2 = @finalssserbasic
				SET @finalssseccgross2 = @finalsssECCbasic								
			--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 
			
			else if @sssbasis = 'basic' and @countempidsss >1  and @withsss='Y' --if more than 2 records basic reference
		  	
			BEgin		
				SET @finalssseegross2 = @finalssseebasic
				SET @finalsssergross2 = @finalssserbasic
				SET @finalssseccgross2 = @finalsssECCbasic
			End 
			

			--condition fall in  other basis reference		
			if @sssbasis = 'others' and @countempidsss =1 and  @withsss ='Y'
			Begin
				SET @finalssseegross2 = @finalssseeotherbasis
				SET @finalsssergross2 = @finalssserotherbasis
				SET @finalssseccgross2 = @finalssseccotherbasis								
			--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 
			
			else if @sssbasis = 'others' and @countempidsss >1  and @withsss=1 --if more than 2 records basic reference
		  	
			BEgin		
				SET @finalssseegross2 = @finalssseeotherbasis
				SET @finalsssergross2 = @finalssserotherbasis
				SET @finalssseccgross2 = @finalssseccotherbasis		
			End 


	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2

update payroll_summary
	set contributionSSSEE =   @finalssseegross2, contributionSSSER = @finalsssergross2, contributionSSSECC = @finalssseccgross2
	where idpayrollsum = @idpayroll0
	 --select [sssemployee]=@finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2




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
 DECLARE @forssstotalbasicpro float
 DECLARE @forssstotalotherbasispro float

 
 DECLARE @forssstotalgross2pro float
 DECLARE @forssstotalbasic2pro float
 DECLARE @forssstotalotherbasis2pro float

 

 DECLARE @ssseegrosspro as float 
 DECLARE @sssergrosspro as float
 DECLARE @ssseebasicpro as float 
 DECLARE @ssserbasicpro as float
 DECLARE @ssseeotherbasispro as float 
 DECLARE @ssserotherbasispro as float

 
  declare @finalssseegrosspro Float
  declare @finalssseebasicpro Float
  declare @finalssseeotherbasispro Float


 declare @finalsssergrosspro as float
 declare @finalssserbasicpro as float
 declare @finalssserotherbasispro as float
 
 declare @finalssseegross2pro as float 
 declare @finalssseebasic2pro as float
 declare @finalssseeotherbasis2pro as float 
  

 declare @finalsssergross2pro as float 
 declare @finalssserbasic2pro as float
 declare @finalssserotherbasis2pro as float 
  
 
 
DECLARE myCursor7 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  and employee_id = @idemployee0 order by idpayrollsum
--SELECT employee_id,sssbasis FROM payroll_summary where  idpayrollsum =24260
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeessspro,@sssbasispro
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
	
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum2pro =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				SELECT @countempidssspro =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forssstotalgrosspro= COALESCE(Sum(grossamttaxable),0) from payroll_summary 
				WHERE Employee_id = @idemployeessspro and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0
				
				SELECT @forssstotalbasicpro= COALESCE(Sum(basic),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0
				
				SELECT @forssstotalotherbasispro= COALESCE(Sum(othermandatorybasis),0) from payroll_summary 
				WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <> @idpayroll0
				
					
				select @forssstotalgross2pro=@grossamt0+@forssstotalgrosspro
				select @forssstotalbasic2pro=@basicamt0+@forssstotalbasicpro
				select @forssstotalotherbasis2pro=@otherbasisamt0+@forssstotalotherbasispro

						
				SELECT TOP 1  @ssseegrosspro = eepro FROM SSS where Range <= @forssstotalgross2pro order by Range desc
				SELECT TOP 1  @sssergrosspro = erpro FROM SSS where Range <= @forssstotalgross2pro order by Range desc
								
				SELECT TOP 1  @ssseebasicpro = eepro FROM SSS where Range <= @forssstotalbasic2pro order by Range desc 
				SELECT TOP 1  @ssserbasicpro = erpro FROM SSS where Range <= @forssstotalbasic2pro  order by Range desc 

				SELECT TOP 1  @ssseeotherbasispro = eepro FROM SSS where Range <= @forssstotalotherbasis2pro order by Range desc 
				SELECT TOP 1  @ssserotherbasispro = erpro FROM SSS where Range <= @forssstotalotherbasis2pro  order by Range desc 
				

				--------EMPLOYEEE GROSS PROCESS		
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
				
	--------EMPLOYEEE SSS PRO BASIC PROCESS		

				SET @finalssseebasicpro =
						CASE 
							WHEN @forssstotalbasic2pro <= 1000.0 THEN 0.0
							WHEN @forssstotalbasic2pro > 1000.0 THEN @ssseebasicpro
						END
					
	--------EMPLOYER SSS PRO BASIC PROCESS		
				Set @finalssserbasicPRO =
							CASE 
								WHEN @forssstotalbasic2 <=1000.0 THEN 0
								WHEN @forssstotalbasic2 >1000.0 THEN @ssserbasicpro
							END			

	--------EMPLOYEEE SSS PRO OTHER BASIS PROCESS		

				SET @finalssseeotherbasispro =
						CASE 
							WHEN @forssstotalotherbasis2pro <= 1000.0 THEN 0.0
							WHEN @forssstotalotherbasis2pro > 1000.0 THEN @ssseeotherbasispro
						END
					
	--------EMPLOYER SSS PRO OTHER BASIS PROCESS		
				Set @finalssserotherbasispro =
							CASE 
								WHEN @forssstotalotherbasis2pro <=1000.0 THEN 0
								WHEN @forssstotalotherbasis2pro >1000.0 THEN @ssserotherbasispro
							END			

							
		
			if @sssbasispro = 'gross' and @countempidssspro=1 and @withssspro='Y' 
		  		Begin
					SET @finalssseegross2pro = @finalssseegrosspro
					SET @finalsssergross2pro = @finalsssergrosspro
				
					--Print 'Gross' 
					--update payroll_summary set contributionSSSEE = @finalssseegross,contributionSSSER=@sssergross,contributionSSSECC =@finalsssECCgross where idpayrollsum=@idpayrollsum2
				End

				else if @sssbasispro = 'gross' and @countempidssspro >1  and @withssspro='Y' --if more than 2 records
		  				BEgin	
							SET @finalssseegross2pro = @finalssseegrosspro
							SET @finalsssergross2pro = @finalsssergrosspro
						
							--	update payroll_summary set contributionSSSEEpro = @finalssseegrosspro,contributionSSSERpro=@finalsssergrosspro where idpayrollsum=@idpayrollsum2pro and  Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart
							--update other sssee to zero 
							--	update payroll_summary set contributionSSSEE =0,contributionSSSER=0 where idpayrollsum<>@idpayrollsum2pro and  Employee_id = @idemployeessspro and idclientp = @idclient and Date_Start= @PayrollPeriodStart
						End 
			
			if @sssbasispro = 'basic' and @countempidssspro =1 and  @withssspro='Y' 
				Begin
				SET @finalssseegross2pro = @finalssseebasicpro
				SET @finalsssergross2pro = @finalssserbasicpro									
				--print basic
				--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
				End 				
			
			else if @sssbasispro = 'basic' and @countempidssspro >1  and @withssspro='Y' --if more than 2 records basic reference
		  	
			BEgin		
				SET @finalssseegross2pro = @finalssseebasicpro
				SET @finalsssergross2pro = @finalssserbasicpro	
				
			End 


			if @sssbasispro = 'others' and @countempidssspro =1 and  @withssspro='Y' 
				Begin
				SET @finalssseegross2pro = @finalssseeotherbasispro
				SET @finalsssergross2pro = @finalssserotherbasispro									
				--print basic
				--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
				End 				
			
			else if @sssbasispro = 'others' and @countempidssspro >1  and @withssspro='Y' --if more than 2 records basic reference
		  	
			BEgin		
				SET @finalssseegross2pro = @finalssseeotherbasispro
				SET @finalsssergross2pro = @finalssserotherbasispro	
				
			End 
  

	
	FETCH NEXT FROM myCursor7 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7

	update payroll_summary
	set contributionSSSEEpro =  @finalssseegross2pro, contributionSSSERpro = @finalsssergross2pro 
	where idpayrollsum = @idpayroll0																				
   --select [sssemployeepro]=@finalssseegross2pro,[sssemployerpro]=@finalsssergross2pro

	
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

DECLARE @phieevalue1basic as float
DECLARE @phiervalue1basic as float

DECLARE @phieevalue1gross as float
DECLARE @phiervalue1gross as float

DECLARE @phieevalue1otherbasis as float
DECLARE @phiervalue1otherbasis as float


DECLARE @phipercentbasic as float
DECLARE @phipercentgross as float 
DECLARE @phipercentotherbasis as float 

DECLARE @forphitotalgross float
DECLARE @forphitotalgross2 float

DECLARE @forphitotalbasic float
DECLARE @forphitotalbasic2 float

DECLARE @forphitotalotherbasis float
DECLARE @forphitotalotherbasis2 float



DECLARE @phiIDgross as int 
DECLARE @phiIDbasic as int
DECLARE @phiIDotherbasis as int


DECLARE @phieegross as float
DECLARE @phiergross as float
DECLARE @phieebasic as float
DECLARE @phierbasic as float
DECLARE @phieeotherbasis as float
DECLARE @phierotherbasis as float



DECLARE @phieebasic2 as float
DECLARE @phierbasic2 as float

 
DECLARE @TDAYSPHI  AS FLOAT 


DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  and employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			
				--- get the max idpayroll
				SELECT TOP 1  @pidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc --Get max idpayrollsumid 
				--count trx
				SELECT @countempidphi =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum <> @idpayroll0 --Gross Basis
				SELECT @forphitotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum <> @idpayroll0 --basic Basis
				SELECT @forphitotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum <> @idpayroll0 --basic Basis
				

				SELECT @forphitotalgross2= @grossamt0+@forphitotalgross			
				SELECT @forphitotalbasic2= @basicamt0+@forphitotalbasic
				SELECT @forphitotalotherbasis2= @otherbasisamt0+@forphitotalotherbasis
											   
				SELECT @TDAYSPHI= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
				
				SELECT TOP 1  @phiIDgross = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalgross2 order by Range desc -- get id from philheal2018 gross reference
				SELECT TOP 1  @phiIDbasic = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic2 order by Range desc --get id from philheal2018 basic reference
				SELECT TOP 1  @phiIDotherbasis = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalotherbasis2 order by Range desc --get id from philheal2018 basic reference
				
			
				SELECT  @phieevalue1basic = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt ee basic
				SELECT  @phiervalue1basic = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt er basic

				SELECT  @phieevalue1gross = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of philhealt ee gross
				SELECT  @phiervalue1gross = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of philhealt er gross
				
				SELECT  @phieevalue1otherbasis = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDotherbasis --get the value of philhealt ee otherbasis
				SELECT  @phiervalue1otherbasis = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDotherbasis --get the value of philhealt er otherbasis


				SELECT  @phipercentbasic = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDbasic  --get the value of percent basic
				SELECT  @phipercentgross = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of percent gross
				SELECT  @phipercentotherbasis = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of percent gross
				
				--continue

				----BASIS of philhealth is GROSS	
				SET @phieegross = 
					CASE 
						WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit					
						CASE  
							WHEN @phiIDgross = 1 THEN @phieevalue1gross --- just get the amount from philhealthealth column
							WHEN @phiIDgross = 2 THEN (@forphitotalgross2*@phipercentgross)/2
							WHEN @phiIDgross = 3 THEN @phieevalue1gross --- just get the amount from philhealthealth column
						END
						else 
						0
					END;
				--ER COMPUTATION
				SET @phiergross= 
					CASE 
						WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit		
						CASE  
							WHEN @phiIDgross = 1 THEN @phiervalue1gross --- just get the amount from philhealthealth column
							WHEN @phiIDgross = 2 THEN (@forphitotalgross2*@phipercentgross)/2
							WHEN @phiIDgross = 3 THEN @phieevalue1gross --- just get the amount from philhealthealth column
						END
						else 
						0
						END;
				


				----BASIS of philhealth is BASIC	
						--EEBASIC
				SET @phieebasic =  
						CASE 
							WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevalue1basic--- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN (@forphitotalbasic2*@phipercentbasic)/2
								WHEN @phiIDbasic = 3 THEN @phieevalue1basic --- just get the amount from philhealthealth column
							END
						ELSE
						0
						END;
				------------------------End Employee Computation ------------------------------------------------------
				
				--ERBASIC				
				SET @phierbasic= 
					CASE 
						WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit
						CASE  
							WHEN @phiIDbasic = 1 THEN @phiervalue1basic --- just get the amount from philhealthealth column
							WHEN @phiIDbasic = 2 THEN (@forphitotalbasic*@phipercentbasic)/2
							WHEN @phiIDbasic = 3 THEN @phiervalue1basic --- just get the amount from philhealthealth column
						END
					ELSE
					0
					END;
					
				----End Employer Computation 


							   				 

				----BASIS of philhealth is OTHER BASIS	
				--EE OTHER BASIS
				SET @phieeotherbasis =  
						CASE 
							WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevalue1otherbasis--- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN (@forphitotalotherbasis2*@phipercentotherbasis)/2
								WHEN @phiIDbasic = 3 THEN @phieevalue1otherbasis --- just get the amount from philhealthealth column
							END
						ELSE
						0
						END;
				------------------------End Employee Computation -------------------------------------------------------


				--ER OTHER BASIS			
				SET @phierotherbasis= 
					CASE 
						WHEN @forphitotalgross2 >=1000 THEN  --NEED TO SET CONDITION HERE set the minimum limit
						CASE  
							WHEN @phiIDbasic = 1 THEN @phiervalue1otherbasis --- just get the amount from philhealthealth column
							WHEN @phiIDbasic = 2 THEN (@forphitotalotherbasis2*@phipercentotherbasis)/2
							WHEN @phiIDbasic = 3 THEN @phiervalue1otherbasis --- just get the amount from philhealthealth column
						END
					ELSE
					0
					END;
					
				----End Employer Computation  OTHER BASIS

							   

			if @phibasis = 'gross'	and @countempidphi =1 and @withphi='Y'   --NOT YET ALIGN
	  			
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@pidpayrollsum2
					set @phieebasic2 = @phieegross
					set @phierbasic2 = @phiergross
				End
			if @phibasis = 'gross' and @countempidphi >1  and @withphi='Y' 
				Begin
					set @phieebasic2 = @phieegross
					set @phierbasic2 = @phiergross
				End


			if @phibasis = 'basic' and @countempidphi=1 and @withphi='Y' 
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@pidpayrollsum2
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phierbasic
				End
			if @phibasis = 'basic' and @countempidphi >1  and @withphi='Y' 
				Begin
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phierbasic					
				End	
			

			if @phibasis = 'others' and @countempidphi =1 and @withphi='Y' 
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@pidpayrollsum2
					set @phieebasic2 = @phieeotherbasis
					set @phierbasic2 = @phierotherbasis
				End
			if @phibasis = 'others' and @countempidphi >1  and @withphi='Y' 
				Begin
					set @phieebasic2 = @phieeotherbasis
					set @phierbasic2 = @phierotherbasis					
				End	

				
				
	FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	update payroll_summary  set 
	contributionphilhealthEE = 	 @phieebasic2, contributionphilhealthER	= @phieebasic2
	where idpayrollsum = @idpayroll0

	


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

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and  employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			--SET @Counter = @Counter + 1
			--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum4 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			--count trx
				SELECT @countempidpag =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forpagtotalgross= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and idpayrollsum <> @idpayroll0
				

				--SELECT TOP 1  @pagibigcontribution= pagibigcontributionee FROM pagibigtable order by dateupdate desc
				SELECT TOP 1  @pagibigcontribution= 200			 
									
				SELECT @forpagtotalgross = @grossamt0+@forpagtotalgross
			
													
				----basic employee	 						   					 				  
				SET @pageebasic =  
						CASE 
							WHEN @forpagtotalgross > 1000.00 THEN @pagibigcontribution
							ELSE
							0
						END;

			----GROSSBASIS
			if @pagbasis = 'gross' and @countempidpag=1 and @withpag='Y'		
		  	
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic		
				End		
			
				else  if @pagbasis = 'gross'and @countempidpag	>1 	and  @withpag='Y' 	
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic				
				End
			--BASICBASIS
			if @pagbasis = 'basic'	and @countempidpag=1 and @withpag='Y'					
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic						
				End
	
			else  if @pagbasis = 'basic'and @countempidpag	>1 	and  @withpag='Y' 	
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic				
				End

				--OTHERBASIS
			if @pagbasis = 'others'	and @countempidpag=1 and @withpag='Y'					
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic						
				End
	
			else  if @pagbasis = 'others'and @countempidpag	>1 	and  @withpag='Y' 	
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic				
				End
						


	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4


	update payroll_summary  set 
	contributionPagibigEE = @pageebasic2,contributionPagibigER= @pageebasic2
	where idpayrollsum = @idpayroll0

----------------------End Pag ibig-------------------------------------------





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
    WHERE idpayrollsum = @idpayroll0
END



IF @idclient IN (105)
BEGIN
    UPDATE payroll_summary
    SET Wtax = CASE 
                    WHEN idbranchpositionp IN (5723,5726,5659,5736,5622) 
                    THEN @WTAXCOMPENSATIONFINAL 
                    ELSE 0 
               END
    WHERE idpayrollsum = @idpayroll0
END
	
-----------------------------End of Tax--------------------------------------------------







		





 
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

DECLARE @Tsqltotaldeduction Nvarchar(max)
DECLARE @Tsqltotaldeduction2 Nvarchar(max)

declare @Tsqltotalnet Nvarchar(max)
declare @Tsqltotalnet2 Nvarchar(max)

DECLARE @Totherdeduction varchar(20)
DECLARE @Totherdeduction2 varchar(20)

DECLARE @TTotaldeduction varchar(20)
DECLARE @Ttotaldeduction2 varchar(30)

DECLARE @Tsss float
DECLARE @Tphi float
DECLARE @Tpag float
DECLARE @Twtax float

DECLARE @TGrosssalary float
DECLARE @TNetamount varchar(30)
DECLARE @TNetamount2 varchar(30)


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
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Twtax= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Twtax as float)+CAST(@Totherdeduction as float)	

			
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
			
			--SELECT @TNetamount = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)	

			SELECT @TNetamount = 
    CAST(@TGrosssalary AS DECIMAL(18,2)) 
  - CAST(@TTotaldeduction AS DECIMAL(18,2));
			
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

 

 









