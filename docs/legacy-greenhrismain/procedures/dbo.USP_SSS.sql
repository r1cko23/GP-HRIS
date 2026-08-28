-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[USP_SSS]
@payrollmonth nvarchar(30),
@idclient int,
@departmentcodep int,
@idclientbranchp int

--@payoutdate nvarchar(20),
--@iddepartmentx int
AS	

BEGIN

--constant value for testing 
--DECLARE @idclient int =157
--DECLARE @payrollmonth nvarchar(20) ='November 2023'
--declare @departmentcodep int =213

declare @idclientlast int
declare @departmentcodeplast int
declare @branchcodelast int
declare @idclientbranchlast int
declare @idemployeesss int



SET NOCOUNT ON;
 

CREATE TABLE #TempTableSSS(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [idpayrollsum] int,
	[Employee_id] int,
	[lname] NVARCHAR(50),
	[fname] NVARCHAR(50),
	[mname] NVARCHAR(50),
	[datehired] NVARCHAR(20), 
	[birthdate] NVARCHAR(20),
	[basisofsssded] NVARCHAR(20),
	[idclient] int,
	[idclientp] int,
	[monthyear] NVARCHAR(20),
	[departmentcodep] int, 
	[idclientbranchp] int, 
	[grossamttaxable] float, 
	[contributionSSSEE] float,
	[contributionSSSER] float,
	[contributionSSSECC] float,
	[contributionSSSEEpro] float,
	[contributionSSSERpro] float,
	[Adjustment] float, 
	[lastbasic] float,
	[sssno] NVARCHAR(30)	
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idx_empid ON #TempTableSSS (Employee_id);
CREATE INDEX idx_idpayrollsum ON #TempTableSSS (idpayrollsum);
CREATE INDEX idx_monthyear ON #TempTableSSS (monthyear);
CREATE INDEX idx_lname ON #TempTableSSS (lname);
CREATE INDEX idx_clientp ON #TempTableSSS (idclientp);


INSERT INTO #TempTableSSS (employee_id,idpayrollsum,lname,fname,mname,basisofsssded,idclient,idclientp,idclientbranchp,monthyear,departmentcodep,grossamttaxable,contributionSSSEE,contributionSSSER,contributionSSSECC,contributionSSSEEpro,contributionSSSERpro,Adjustment,lastbasic,sssno,birthdate,datehired)
		
SELECT        employee_id, idpayrollsum, lname, fname,  mname, basisofsssded,idclient,idclientp,idclientbranchp, payrollmonth,department_codep,grossamttaxable,contributionSSSEE,contributionSSSER,contributionSSSECC,contributionSSSEEpro,contributionSSSERpro,Adjustment,lastbasic,SSSno, FORMAT(date_Birth, 'MM/dd/yyyy') AS date_Birth,FORMAT(datehired, 'MM/dd/yyyy') AS date_hired
FROM          FORSSS
where payrollmonth = @payrollmonth
order by lname,fname


---SET get last idclient 
DECLARE myCursor2 CURSOR FOR

	SELECT employee_id FROM #TempTableSSS where monthyear=@payrollmonth and idclientp <> @idclient
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
		--get last idclientp and department
		 SELECT TOP 1  @idclientlast =  idclientp FROM #TempTableSSS where Employee_id = @idemployeesss and monthyear = @payrollmonth and contributionSSSEE <>0 order by idpayrollsum desc
		 SELECT TOP 1  @departmentcodeplast =  departmentcodep FROM #TempTableSSS where Employee_id = @idemployeesss and monthyear = @payrollmonth and contributionSSSEE <>0 order by idpayrollsum desc
		 SELECT TOP 1  @idclientbranchlast =  idclientbranchp FROM #TempTableSSS where Employee_id = @idemployeesss and monthyear = @payrollmonth and contributionSSSEE <>0 order by idpayrollsum desc


		--update 	as per request of mam lea not to consolidate
	--	update #TempTableSSS
	--	set idclientp = @idclientlast,
	--	departmentcodep = @departmentcodeplast,
	--	idclientbranchp = @idclientbranchlast		
	--	Where Employee_id = @idemployeesss 


		FETCH NEXT FROM myCursor2 INTO @idemployeesss
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2    
	   	 
-- Retrieve data from #TempTable
--SELECT * FROM #TempTableSSS  
--where idclientp = @idclient
--order by lname



SELECT      sum(#TempTableSSS.contributionSSSEE) as sssee, 
			sum(#TempTableSSS.contributionSSSER) as ssser , 
			sum(#TempTableSSS.contributionSSSECC) as sssecc , 
			sum(#TempTableSSS.contributionSSSEEpro) as ssseepro,
			sum(#TempTableSSS.contributionSSSERpro) as  ssserpro,
			sum(#TempTableSSS.grossamttaxable) as grosstaxableamt,
			sum(#TempTableSSS.Adjustment) as adjustmentamount,
			sum(#TempTableSSS.lastbasic) as lastbasic1,
			#TempTableSSS.Employee_id,#TempTableSSS.fname,#TempTableSSS.lname,#TempTableSSS.mname,#TempTableSSS.monthyear,#TempTableSSS.basisofsssded,#TempTableSSS.idclient,#TempTableSSS.departmentcodep,#TempTableSSS.monthyear,companyname, Department.Department_desc,client_branch.branch,#TempTableSSS.sssno,#TempTableSSS.birthdate,#TempTableSSS.datehired
FROM            #TempTableSSS 
                         INNER JOIN client ON #TempTableSSS.idclientp = client.idclient
						 INNER JOIN Department ON #TempTableSSS.departmentcodep = Department.iddepartment
						 INNER JOIN client_branch ON #TempTableSSS.idclientbranchp = client_branch.idclientbranch						 
						 where  (@idclient = 0 OR idclientp = @idclient)
						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
						 
			group by #TempTableSSS.Employee_id, #TempTableSSS.fname,#TempTableSSS.lname,#TempTableSSS.mname,#TempTableSSS.monthyear,#TempTableSSS.basisofsssded,#TempTableSSS.idclient,#TempTableSSS.departmentcodep,#TempTableSSS.monthyear,companyname,Department.Department_desc,client_branch.branch,#TempTableSSS.sssno,#TempTableSSS.birthdate,#TempTableSSS.datehired
			HAVING (sum(#TempTableSSS.contributionSSSEE) <> 0)
			order by lname,fname asc;


--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTableSSS;


END

